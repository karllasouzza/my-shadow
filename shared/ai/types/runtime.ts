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
}
