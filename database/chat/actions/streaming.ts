import {
  conversationKey,
  getStorage,
  loadConversation,
  saveConversation,
} from "@/database/chat";
import { ChatMessage } from "@/shared/ai/types";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { STREAMING_KEY_SUFFIX } from "../constrants";

function streamingKey(convId: string) {
  return `${conversationKey(convId)}${STREAMING_KEY_SUFFIX}`;
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
