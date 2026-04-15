import type { GenerationMetrics } from "@/shared/ai/metrics";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  thinking?: string;
  modelId?: string;
  errorCode?: string;
  timestamp: string;
  /** Generation metrics (only for assistant messages) */
  generationMetrics?: GenerationMetrics;
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
  modelId?: string,
  errorCode?: string,
): ChatMessage {
  return {
    role,
    content,
    thinking: thinking ?? undefined,
    modelId: modelId ?? undefined,
    errorCode: errorCode ?? undefined,
    timestamp: new Date().toISOString(),
  };
}
