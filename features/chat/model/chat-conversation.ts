import { ChatConversation } from "@/database/chat/types";
import crypto from "expo-crypto";

const HISTORY_PREVIEW_SUFFIX_PATTERN =
  /\s*\[(?:cancelado|erro na geração)\]\s*$/i;

export function autoGenerateTitle(firstUserMessage: string): string {
  const truncated = firstUserMessage.trim().slice(0, 50);
  return truncated.length >= 50 ? `${truncated}...` : truncated;
}

export function createChatConversation(
  title: string,
  modelId: string,
): ChatConversation {
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    lastModelUsedId: modelId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a safe, single-line snippet for the last message.
 * - Collapses whitespace/newlines
 * - Truncates to `maxLength` characters and appends an ellipsis when needed
 */
export function createLastMessageSnippet(
  content: string | undefined,
  maxLength = 100,
): string {
  if (!content) return "";

  const singleLine = content
    .replace(HISTORY_PREVIEW_SUFFIX_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!singleLine) return "";
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength)}...`;
}
