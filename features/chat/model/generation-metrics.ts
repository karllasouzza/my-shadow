/**
 * Generation Metrics
 *
 * Helpers for sanitizing generation performance metrics during LLM streaming.
 */

import type { ChatMessage } from "./chat-message";

/**
 * Sanitizes messages by removing generationMetrics before sending to LLM.
 * This prevents historical metrics from polluting the context of new generations.
 *
 * Does NOT mutate original messages — returns a new array with shallow copies.
 *
 * @param messages - Messages that may contain generationMetrics
 * @returns New array of messages without generationMetrics
 */
export function sanitizeMessagesForLLMContext(
  messages: ChatMessage[],
): ChatMessage[] {
  return messages.map((msg) => {
    // Only strip generationMetrics, preserve everything else
    const { generationMetrics: _, ...rest } = msg;
    return rest as ChatMessage;
  });
}
