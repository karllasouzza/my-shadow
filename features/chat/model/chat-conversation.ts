/**
 * T008: ChatConversation type definition
 *
 * Represents a complete conversation with the AI.
 * Persisted as a single MMKV key `chat:{id}`.
 */

import { ChatMessage } from "./chat-message";

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  modelId: string;
  messages: ChatMessage[];
}

/** Lightweight index entry for history list — avoids loading full bodies */
export interface ChatConversationIndex {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageSnippet: string; // First 100 chars of last message for preview
}

/** Auto-generate title from first user message (truncate to 50 chars) */
export function autoGenerateTitle(firstUserMessage: string): string {
  const truncated = firstUserMessage.trim().slice(0, 50);
  return truncated.length >= 50 ? `${truncated}...` : truncated;
}

/** Validate conversation title (max 100 chars, non-empty) */
export function validateTitle(title: string): {
  isValid: boolean;
  error?: string;
} {
  if (!title || title.trim().length === 0) {
    return { isValid: false, error: "Title cannot be empty" };
  }
  if (title.length > 100) {
    return {
      isValid: false,
      error: `Title exceeds maximum length of 100 characters (got ${title.length})`,
    };
  }
  return { isValid: true };
}

/**
 * Create a safe, single-line snippet for the last message.
 * - Collapses whitespace/newlines
 * - Truncates to `maxLength` characters and appends an ellipsis when needed
 */
export function getLastMessageSnippet(
  messages: ChatMessage[] | undefined,
  maxLength = 100,
): string {
  if (!messages || messages.length === 0) return "";
  const last = messages[messages.length - 1];
  if (!last || !last.content) return "";

  const singleLine = last.content.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength)}...`;
}
