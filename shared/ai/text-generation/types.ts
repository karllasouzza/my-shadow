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

export interface RuntimeConfig {
  model: string;
  n_ctx: number;
  n_batch: number;
  n_ubatch?: number;
  n_threads: number;
  n_threads_batch?: number;
  n_gpu_layers: number;
  use_mmap: boolean;
  use_mlock: boolean;
  cache_type_k: CacheType;
  cache_type_v: CacheType;
  flash_attn?: boolean;
  n_predict?: number;
  n_parallel?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  dry_penalty_last_n?: number;
}
