/**
 * Database: Chat Conversations
 *
 * Centraliza toda persistência de conversas usando MMKV.
 * Substitui features/chat/service/chat-service.ts
 *
 * Storage format:
 * - Full conversation: MMKV key `chat:{id}` → JSON string of ChatConversation
 * - Index: MMKV key `chat:index` → JSON string of ChatConversationIndex[]
 */

import type {
  ChatConversation,
  ChatConversationIndex,
} from "@/features/chat/model/chat-conversation";
import {
  autoGenerateTitle,
  getLastMessageSnippet,
  validateTitle,
} from "@/features/chat/model/chat-conversation";
import { createChatMessage } from "@/features/chat/model/chat-message";
import type { ChatMessage } from "@/shared/ai/types/chat";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { randomUUID } from "expo-crypto";
import { createMMKV, type MMKV } from "react-native-mmkv";

const INDEX_KEY = "chat:index";

let storage: MMKV | null = null;

export function getStorage(): MMKV {
  if (!storage) {
    storage = createMMKV({ id: "chat_conversations" });
  }
  return storage;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/** Create a new conversation with empty messages array */
export function createConversation(modelId: string): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: "Nova conversa",
    createdAt: now,
    updatedAt: now,
    modelId,
    messages: [],
  };
}

/** Save conversation to MMKV and update index */
export function saveConversation(conversation: ChatConversation): Result<void> {
  try {
    const store = getStorage();
    store.set(`chat:${conversation.id}`, JSON.stringify(conversation));
    updateIndex(conversation);
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to save conversation",
        {},
        error as Error,
      ),
    );
  }
}

/** Load full conversation by ID */
export function loadConversation(id: string): Result<ChatConversation | null> {
  try {
    const store = getStorage();
    const raw = store.getString(`chat:${id}`);
    if (!raw) return ok(null);
    const conv = JSON.parse(raw) as ChatConversation;
    return ok(conv);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to load conversation",
        {},
        error as Error,
      ),
    );
  }
}

/** List all conversations as lightweight index (sorted by updatedAt desc) */
export function listConversations(): Result<ChatConversationIndex[]> {
  try {
    const store = getStorage();
    const raw = store.getString(INDEX_KEY);
    if (!raw) return ok([]);
    const index: ChatConversationIndex[] = JSON.parse(raw);
    index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return ok(index);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to list conversations",
        {},
        error as Error,
      ),
    );
  }
}

/** Rename conversation title */
export function renameConversation(
  id: string,
  newTitle: string,
): Result<ChatConversation | null> {
  const titleValidation = validateTitle(newTitle);
  if (!titleValidation.isValid) {
    return err(
      createError("VALIDATION_ERROR", titleValidation.error ?? "Invalid title"),
    );
  }

  const loadResult = loadConversation(id);
  if (!loadResult.success) return err(loadResult.error);
  const conv = loadResult.data;
  if (!conv) return ok(null);

  conv.title = newTitle.trim();
  conv.updatedAt = new Date().toISOString();
  return saveAndReturn(conv);
}

/** Delete conversation and remove from index */
export function deleteConversation(id: string): Result<void> {
  try {
    const store = getStorage();
    store.set(`chat:${id}`, "");
    removeFromIndex(id);
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to delete conversation",
        {},
        error as Error,
      ),
    );
  }
}

// ============================================================================
// Message Operations
// ============================================================================

/** Append a user message and save */
export function appendUserMessage(
  conversationId: string,
  content: string,
): Result<ChatConversation | null> {
  const loadResult = loadConversation(conversationId);
  if (!loadResult.success) return err(loadResult.error);

  const conv = loadResult.data;
  if (!conv) return ok(null);

  const message = createChatMessage("user", content);
  conv.messages.push(message);
  conv.updatedAt = new Date().toISOString();

  // Auto-generate title from first user message
  if (conv.messages.filter((m) => m.role === "user").length === 1) {
    conv.title = autoGenerateTitle(content);
  }

  return saveAndReturn(conv);
}

/** Append an assistant message and save */
export function appendAssistantMessage(
  conversationId: string,
  content: string,
): Result<ChatConversation | null> {
  const loadResult = loadConversation(conversationId);
  if (!loadResult.success) return err(loadResult.error);
  const conv = loadResult.data;
  if (!conv) return ok(null);

  const message = createChatMessage("assistant", content);
  conv.messages.push(message);
  conv.updatedAt = new Date().toISOString();

  return saveAndReturn(conv);
}

function updateIndex(conversation: ChatConversation): void {
  const store = getStorage();
  const raw = store.getString(INDEX_KEY);
  let index: ChatConversationIndex[] = [];
  if (raw) {
    try {
      index = JSON.parse(raw);
    } catch {
      index = [];
    }
  }

  const existingIdx = index.findIndex((e) => e.id === conversation.id);
  const entry: ChatConversationIndex = {
    id: conversation.id,
    title: conversation.title,
    lastMessageSnippet: getLastMessageSnippet(conversation.messages),
    updatedAt: conversation.updatedAt,
  };

  if (existingIdx >= 0) {
    index[existingIdx] = entry;
  } else {
    index.push(entry);
  }

  store.set(INDEX_KEY, JSON.stringify(index));
}

function removeFromIndex(id: string): void {
  const store = getStorage();
  const raw = store.getString(INDEX_KEY);
  if (!raw) return;
  try {
    let index: ChatConversationIndex[] = JSON.parse(raw);
    index = index.filter((e) => e.id !== id);
    store.set(INDEX_KEY, JSON.stringify(index));
  } catch {
    store.set(INDEX_KEY, "[]");
  }
}

function saveAndReturn(conv: ChatConversation): Result<ChatConversation> {
  const saveResult = saveConversation(conv);
  if (!saveResult.success) return err(saveResult.error);
  return ok(conv);
}

// --------------------------------------------------------------------------
// Streaming partials (persist transient streaming assistant messages)
// Stored under key `chat:{conversationId}:streaming` to survive restarts.
// --------------------------------------------------------------------------

function streamingKey(convId: string) {
  return `chat:${convId}:streaming`;
}

/** Upsert a streaming partial for a conversation (overwrites previous) */
export function upsertStreamingMessage(
  conversationId: string,
  message: ChatMessage,
): Result<void> {
  try {
    const store = getStorage();
    store.set(streamingKey(conversationId), JSON.stringify(message));
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to upsert streaming message",
        {},
        error as Error,
      ),
    );
  }
}

/** Load the persisted streaming partial for a conversation, if any */
export function loadStreamingMessage(
  conversationId: string,
): Result<ChatMessage | null> {
  try {
    const store = getStorage();
    const raw = store.getString(streamingKey(conversationId));
    if (!raw) return ok(null);
    const msg = JSON.parse(raw) as ChatMessage;
    return ok(msg);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to load streaming message",
        {},
        error as Error,
      ),
    );
  }
}

/** Remove persisted streaming partial */
export function clearStreamingMessage(conversationId: string): Result<void> {
  try {
    const store = getStorage();
    store.set(streamingKey(conversationId), "");
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to clear streaming message",
        {},
        error as Error,
      ),
    );
  }
}

/** Commit persisted partial into conversation (append final message and clear partial) */
export function commitStreamingMessage(
  conversationId: string,
  finalMessage: ChatMessage,
): Result<void> {
  try {
    const load = loadConversation(conversationId);
    if (!load.success) return err(load.error);
    const conv = load.data;
    if (!conv) return ok(undefined);

    conv.messages.push(finalMessage);
    conv.updatedAt = new Date().toISOString();
    const saveRes = saveConversation(conv);
    if (!saveRes.success) return err(saveRes.error);
    // Clear the partial after saving final message
    clearStreamingMessage(conversationId);
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to commit streaming message",
        {},
        error as Error,
      ),
    );
  }
}
