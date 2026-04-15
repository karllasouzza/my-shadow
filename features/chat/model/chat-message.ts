import { ChatMessage, MessageRole } from "@/shared/ai/types/chat";

/** Validation: content non-empty, max 10,000 chars */
export function validateChatMessage(content: string): {
  isValid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { isValid: false, error: "A mensagem não pode estar vazia" };
  }
  if (content.length > 10_000) {
    return {
      isValid: false,
      error: `A mensagem excede o comprimento máximo de 10.000 caracteres (obtido ${content.length})`,
    };
  }
  return { isValid: true };
}

/** Create a ChatMessage with defaults */
export function createChatMessage(
  role: MessageRole,
  content: string,
  reasoning_content?: string,
  modelId?: string,
  errorCode?: string,
): ChatMessage {
  return {
    role,
    content,
    reasoning_content: reasoning_content ?? undefined,
    modelId: modelId ?? undefined,
    errorCode: errorCode ?? undefined,
    timestamp: new Date().toISOString(),
  };
}
