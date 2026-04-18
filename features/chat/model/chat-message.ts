import { ChatMessage, MessageRole } from "@/database/chat/types";
import { generateUUID } from "@/shared/random-id";

/** Create a ChatMessage with defaults */
export function createChatMessage(
  role: MessageRole,
  content: string,
  reasoning_content?: string,
  modelId?: string,
  errorCode?: string,
): ChatMessage {
  return {
    id: generateUUID(),
    role,
    content,
    reasoning_content: reasoning_content ?? undefined,
    modelId: modelId ?? undefined,
    errorCode: errorCode ?? undefined,
    createdAt: new Date().toISOString(),
  };
}
