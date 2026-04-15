import type { GenerationMetrics } from "@/shared/ai/metrics";

export interface LoadedModel {
  id: string;
  isLoaded: boolean;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export interface CompletionOutput {
  text: string;
  reasoning?: string;
  /** Generation metrics (TTTF, TPS, etc.) - present only for successful completions */
  metrics?: GenerationMetrics;
}

/** Callback that receives a streaming chunk with optional reasoning/thinking content. */
export type OnStreamChunk = (data: {
  token: string;
  /**
   * Structured reasoning content provided by the runtime.
   */
  reasoning?: string;
}) => void;

export interface StreamCompletionOptions {
  /** Receives streaming chunks with separated reasoning content. */
  onStreamChunk?: OnStreamChunk;
  abortSignal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  enableThinking?: boolean;
  /** Conversation ID for persistence - if provided, runtime will persist the message */
  conversationId?: string;
  /** Model ID for the message metadata */
  modelId?: string;
  /** Timestamp for the message - will be set to current time if not provided */
  timestamp?: string;
}
