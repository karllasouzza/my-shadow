import type { LlamaContext, TokenData } from "llama.rn";

export interface LoadedModel {
  id: string;
  isLoaded: true;
}

export interface StreamCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  enableThinking?: boolean;
  abortSignal?: AbortSignal;
  onStreamChunk?: (chunk: { token: string; reasoning?: string }) => void;
}

export interface CompletionOutput {
  text: string;
  reasoning?: string;
  timings: {
    prompt_ms: number;
    predicted_ms: number;
    prompt_tokens: number;
    predicted_tokens: number;
  };
}

export interface StreamCallbacks {
  onToken?: (token: string, reasoning?: string) => void;
}

export type { LlamaContext, TokenData };
