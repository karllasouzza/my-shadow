/**
 * T008: ChatMessage type definition
 *
 * Individual message within a conversation. Embedded in ChatConversation.messages.
 */

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  thinking?: string; // Seção "Thoughts" — processo de raciocínio da IA (expansível)
  timestamp: string; // ISO 8601
}

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
  thinking?: string,
): ChatMessage {
  return {
    role,
    content,
    thinking: thinking ?? undefined,
    timestamp: new Date().toISOString(),
  };
}
