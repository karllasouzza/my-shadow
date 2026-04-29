import type { ConsentRequest, ToolDefinition } from "@/shared/ai/tools/types";
import type { NativeCompletionResultTimings, ToolCall } from "llama.rn";

export interface CompletionOutput {
  text: string;
  reasoning?: string;
  timings: NativeCompletionResultTimings;
  tool_calls?: ToolCall[];
}

export interface StreamCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  enableThinking?: boolean;
  abortSignal?: AbortSignal;
  onStreamChunk?: (chunk: { token: string; reasoning?: string }) => void;
  tools?: ToolDefinition[];
  onConsentRequired?: (request: ConsentRequest) => void;
}

export type CacheType = "f16" | "q8_0" | "q4_0";
