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
}

export type OnTokenCallback = (token: string) => void;

/** Callback that receives a streaming chunk with optional reasoning/thinking content. */
export type OnStreamChunk = (data: {
  token: string;
  reasoningContent: string;
}) => void;

export interface StreamCompletionOptions {
  onToken?: OnTokenCallback;
  /**
   * Receives streaming chunks with separated reasoning content.
   * When provided, `onToken` is ignored.
   */
  onStreamChunk?: OnStreamChunk;
  abortSignal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  enableThinking?: boolean;
}
