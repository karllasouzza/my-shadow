/**
 * T010: Chat repository — MMKV persistence for conversations
 *
 * Storage format:
 * - Full conversation: MMKV key `chat:{id}` → JSON string of ChatConversation
 * - Index: MMKV key `chat:index` → JSON string of ChatConversationIndex[]
 */

import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { createMMKV, type MMKV } from "react-native-mmkv";
import type {
    ChatConversation,
    ChatConversationIndex,
} from "../model/chat-conversation";
import { autoGenerateTitle, validateTitle } from "../model/chat-conversation";
import { createChatMessage } from "../model/chat-message";

const INDEX_KEY = "chat:index";

let storage: MMKV | null = null;

function getStorage(): MMKV {
  if (!storage) {
    storage = createMMKV({ id: "chat_conversations" });
  }
  return storage;
}

/** Create a new conversation with empty messages array */
export function createConversation(modelId: string): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
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
    // Save full body
    store.set(`chat:${conversation.id}`, JSON.stringify(conversation));
    // Update index
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
    // Sort by updatedAt descending (newest first)
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
    // Remove full body by setting to null/empty
    store.set(`chat:${id}`, "");
    // Remove from index
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

// --- Private helpers ---

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
    // If index is corrupted, just reset it
    store.set(INDEX_KEY, "[]");
  }
}

function saveAndReturn(conv: ChatConversation): Result<ChatConversation> {
  const saveResult = saveConversation(conv);
  if (!saveResult.success) return err(saveResult.error);
  return ok(conv);
}
