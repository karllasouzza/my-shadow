import { ChatMessage, MessageRole } from "@/database/chat/types";
import crypto from "expo-crypto";

/** Create a ChatMessage with defaults */
export function createChatMessage(
  role: MessageRole,
  content: string,
  reasoning_content?: string,
  modelId?: string,
  errorCode?: string,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    reasoning_content: reasoning_content ?? undefined,
    modelId: modelId ?? undefined,
    errorCode: errorCode ?? undefined,
    createdAt: new Date().toISOString(),
  };
}
