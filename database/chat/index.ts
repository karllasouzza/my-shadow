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
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { randomUUID } from "expo-crypto";
import { createMMKV, type MMKV } from "react-native-mmkv";
import {
  CONVERSATION_KEY_PREFIX,
  INDEX_KEY,
  STREAMING_KEY_SUFFIX,
} from "./constrants";

let storage: MMKV | null = null;

export function getStorage(): MMKV {
  if (!storage) {
    storage = createMMKV({ id: "chat_conversations" });
  }
  return storage;
}

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

export function saveConversation(conversation: ChatConversation): Result<void> {
  try {
    const store = getStorage();
    store.set(conversationKey(conversation.id), JSON.stringify(conversation));
    upsertIndexEntry(store, conversation);
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
    const raw = store.getString(conversationKey(id));
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
    const index = syncIndexWithPersistedConversations(store);
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
    store.set(conversationKey(id), "");
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

export function conversationKey(id: string): string {
  return `${CONVERSATION_KEY_PREFIX}${id}`;
}

function readPersistedConversation(
  store: MMKV,
  id: string,
): ChatConversation | null {
  const raw = store.getString(conversationKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChatConversation;
    // Basic shape validation: ensure parsed object looks like a conversation
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !Array.isArray((parsed as any).messages)) return null;
    return parsed;
  } catch {
    // If parsing fails, skip this key — it isn't a persisted conversation.
    return null;
  }
}

function readIndex(store: MMKV): ChatConversationIndex[] {
  const raw = store.getString(INDEX_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ChatConversationIndex[];
  } catch {
    return [];
  }
}

function writeIndex(store: MMKV, index: ChatConversationIndex[]): void {
  store.set(INDEX_KEY, JSON.stringify(index));
}

function buildIndexEntry(
  conversation: ChatConversation,
): ChatConversationIndex {
  return {
    id: conversation.id,
    title: conversation.title,
    lastMessageSnippet: getLastMessageSnippet(conversation.messages),
    updatedAt: conversation.updatedAt,
  };
}

function upsertIndexEntry(store: MMKV, conversation: ChatConversation): void {
  const index = readIndex(store);
  const existingIdx = index.findIndex((entry) => entry.id === conversation.id);
  const nextEntry = buildIndexEntry(conversation);

  if (existingIdx >= 0) {
    index[existingIdx] = nextEntry;
  } else {
    index.push(nextEntry);
  }

  writeIndex(store, index);
}

function listPersistedConversationIds(store: MMKV): string[] {
  const allKeys =
    typeof (store as any).getAllKeys === "function"
      ? (store as any).getAllKeys()
      : [];

  return allKeys
    .filter(
      (key: string) =>
        key.startsWith(CONVERSATION_KEY_PREFIX) &&
        key !== INDEX_KEY &&
        !key.endsWith(STREAMING_KEY_SUFFIX),
    )
    .map((key: string) => key.slice(CONVERSATION_KEY_PREFIX.length));
}

function syncIndexWithPersistedConversations(
  store: MMKV,
): ChatConversationIndex[] {
  const nextIndex = listPersistedConversationIds(store)
    .map((conversationId) => readPersistedConversation(store, conversationId))
    .filter(
      (conversation): conversation is ChatConversation => conversation !== null,
    )
    .map(buildIndexEntry);

  const currentIndex = readIndex(store);
  if (!areIndexesEqual(currentIndex, nextIndex)) {
    writeIndex(store, nextIndex);
  }

  return nextIndex;
}

function areIndexesEqual(
  left: ChatConversationIndex[],
  right: ChatConversationIndex[],
): boolean {
  if (left.length !== right.length) return false;

  const sortedLeft = [...left].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRight = [...right].sort((a, b) => a.id.localeCompare(b.id));

  return sortedLeft.every((entry, index) => {
    const other = sortedRight[index];
    return (
      entry.id === other.id &&
      entry.title === other.title &&
      entry.updatedAt === other.updatedAt &&
      entry.lastMessageSnippet === other.lastMessageSnippet
    );
  });
}

function removeFromIndex(id: string): void {
  const store = getStorage();
  const index = readIndex(store).filter((entry) => entry.id !== id);
  writeIndex(store, index);
}

function saveAndReturn(conv: ChatConversation): Result<ChatConversation> {
  const saveResult = saveConversation(conv);
  if (!saveResult.success) return err(saveResult.error);
  return ok(conv);
}
