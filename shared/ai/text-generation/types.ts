import type { NativeCompletionResultTimings } from "llama.rn";

export interface CompletionOutput {
  text: string;
  reasoning?: string;
  timings: NativeCompletionResultTimings;
}

export interface StreamCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  enableThinking?: boolean;
  abortSignal?: AbortSignal;
  onStreamChunk?: (chunk: { token: string; reasoning?: string }) => void;
}

export type CacheType = "f16" | "q8_0" | "q4_0";
