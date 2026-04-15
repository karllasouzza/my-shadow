import type { GenerationMetrics } from "../metrics";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  reasoning_content?: string;
  modelId?: string;
  errorCode?: string;
  timestamp?: string;
  /** Generation metrics (only for assistant messages) */
  generationMetrics?: GenerationMetrics;
}
