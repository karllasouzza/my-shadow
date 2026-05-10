import { ChatMessage } from "@/database/chat/types";
import type {
  ConsentRequest,
  ToolDefinition,
  ToolResult,
} from "@/shared/ai/tools/types";
import { Result } from "@/shared/utils/app-error";
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

export interface StreamCompletionWithToolsOptions extends StreamCompletionOptions {
  /** Maximum tool call iterations (default: 3) */
  maxIterations?: number;
  /** Callback to execute a tool by name with parsed parameters */
  onToolCall: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<ToolResult | null>;
  /** Called when the model requests tool execution */
  onToolExecutionStart?: (toolNames: string[]) => void;
  /** Per-tool execution overrides */
  toolOverrides?: Record<string, { timeoutMs?: number; maxRetries?: number }>;
}

export type CacheType = "f16" | "q8_0" | "q4_0";

export interface RunToolLoopParams {
  messages: ChatMessage[];
  options: ToolLoopOptions;
  onComplete: CompletionFunction;
}

export interface ToolLoopOptions {
  maxIterations?: number;
  onToolCall: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<ToolResult | null>;
  onToolExecutionStart?: (toolNames: string[]) => void;
  toolOverrides?: Record<string, { timeoutMs?: number; maxRetries?: number }>;
  abortSignal?: AbortSignal;
}

export type CompletionFunction = (
  messages: ChatMessage[],
) => Promise<Result<CompletionOutput>>;
