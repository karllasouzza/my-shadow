// ─── Branded Types ───
export type ModelId = string & { readonly __brand: "ModelId" };

// ─── Error Types ───
export type EngineErrorCode =
  | "MODEL_NOT_LOADED"
  | "LOAD_FAILED"
  | "OOM"
  | "GENERATION_FAILED"
  | "ABORTED"
  | "EMPTY_RESPONSE"
  | "INVALID_CONFIG"
  | "UNKNOWN";

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

// ─── Result Type ───
export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: EngineError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(
  code: EngineErrorCode,
  message: string,
  cause?: unknown,
): Result<never> {
  return { ok: false, error: { code, message, cause } };
}

// ─── Stream Events (discriminated union) ───
export type StreamEvent =
  | { readonly type: "text"; readonly token: string }
  | { readonly type: "thinking"; readonly token: string }
  | { readonly type: "tool_call"; readonly call: ToolCall }
  | { readonly type: "done"; readonly output: CompletionOutput }
  | { readonly type: "error"; readonly error: EngineError };

// ─── Tool Call Types ───
export interface ToolCall {
  readonly id: string;
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

// ─── Completion Output ───
export interface CompletionOutput {
  readonly text: string;
  readonly reasoning: string | null;
  readonly timings: CompletionTimings | null;
  readonly toolCalls: readonly ToolCall[];
}

export interface CompletionTimings {
  readonly promptTokens: number;
  readonly generatedTokens: number;
  readonly totalMs: number;
  readonly tokensPerSecond: number;
  readonly timeToFirstToken: number;
}

// ─── Engine State ───
export interface EngineState {
  readonly modelId: ModelId | null;
  readonly isLoaded: boolean;
  readonly isGenerating: boolean;
  readonly isToolUseSupported: boolean;
  readonly isThinkingSupported: boolean;
}

// ─── Generation Options ───
export interface GenerateOptions {
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly enableThinking?: boolean;
  readonly abortSignal?: AbortSignal;
  readonly onEvent?: (event: StreamEvent) => void;
  readonly tools?: readonly ToolDefinitionForEngine[];
  readonly maxToolIterations?: number;
  readonly onToolCall?: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<ToolResultForEngine | null>;
  readonly onToolExecutionStart?: (toolNames: readonly string[]) => void;
}

// ─── Tool types used by the engine (imported from tools module later) ───
export interface ToolDefinitionForEngine {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JSONSchemaObject;
}

export interface ToolResultForEngine {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly errorCode?: string;
}

export interface JSONSchemaObject {
  readonly type: "object";
  readonly properties: Record<string, JSONSchemaProperty>;
  readonly required?: readonly string[];
}

export interface JSONSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly default?: unknown;
  readonly minimum?: number;
  readonly maximum?: number;
}

// ─── Message Types ───
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  readonly role: MessageRole;
  readonly content: string;
  readonly tool_calls?: readonly ToolCall[];
  readonly tool_call_id?: string;
}

// ─── Config Types ───
export type RamTier = "low" | "mid" | "high";

export interface ContextConfig {
  readonly n_ctx: number;
  readonly n_batch: number;
  readonly n_ubatch: number;
  readonly n_threads: number;
  readonly n_gpu_layers: number;
  readonly cache_type_k: string;
  readonly cache_type_v: string;
  readonly use_mlock: boolean;
  readonly use_mmap: boolean;
  readonly flash_attn: boolean;
}

export interface LoadedModel {
  readonly id: ModelId;
  readonly config: ContextConfig;
  readonly isToolUseSupported: boolean;
  readonly isThinkingSupported: boolean;
}

// ─── Thinking State ───
export interface ThinkingState {
  isInsideThinkBlock: boolean;
  reasoning: string;
  buffer: string;
}

// ─── Stream Accumulator State ───
export interface StreamAccumulator {
  text: string;
  reasoning: string;
  toolCalls: ToolCall[];
  seenToolCallIds: Set<string>;
  ttftMs: number | null;
  startTime: number;
}
