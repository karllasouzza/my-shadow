// ─── Branded Types ───
export type ToolName = string & { readonly __brand: "ToolName" };

// ─── Error Types ───
export type ToolErrorCode =
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "CAPTCHA"
  | "BLOCKED"
  | "SIZE_LIMIT"
  | "PARSE_ERROR"
  | "INVALID_URL"
  | "NOT_FOUND"
  | "DISABLED"
  | "EXECUTION_FAILED"
  | "USER_DECLINED"
  | "UNKNOWN";

export interface ToolError {
  readonly code: ToolErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

// ─── Result Type ───
export type ToolResult<T = unknown> =
  | { readonly ok: true; readonly data: T; readonly source?: string }
  | { readonly ok: false; readonly error: ToolError };

export function toolOk<T>(data: T, source?: string): ToolResult<T> {
  return source ? { ok: true, data, source } : { ok: true, data };
}

export function toolFail(
  code: ToolErrorCode,
  message: string,
  cause?: unknown,
): ToolResult<never> {
  return { ok: false, error: { code, message, cause } };
}

// ─── JSON Schema ───
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

// ─── Tool Definition ───
export interface ToolRegistration {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JSONSchemaObject;
  readonly handler: ToolHandler;
  readonly enabled?: boolean;
}

export interface ToolDefinition {
  readonly name: ToolName;
  readonly description: string;
  readonly inputSchema: JSONSchemaObject;
  readonly handler: ToolHandler;
  readonly enabled: boolean;
}

// ─── Tool Handler ───
export type ToolHandler = (
  params: Record<string, unknown>,
  context?: ExecutionContext,
) => Promise<ToolResult>;

// ─── Execution Context ───
export interface ExecutionContext {
  readonly signal?: AbortSignal;
}

// ─── Executor Config ───
export interface ExecutorConfig {
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
}

export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  timeoutMs: 30_000,
  maxRetries: 2,
  baseBackoffMs: 1000,
  maxBackoffMs: 5000,
} as const;

// ─── Llama Tool Format (for llama.rn integration) ───
export interface LlamaToolFormat {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: JSONSchemaObject;
  };
}

export function toLlamaToolFormat(definition: ToolDefinition): LlamaToolFormat {
  return {
    type: "function",
    function: {
      name: definition.name,
      description: definition.description,
      parameters: definition.inputSchema,
    },
  };
}

// ─── Fetch URL Types ───
export interface FetchUrlOptions {
  readonly timeoutMs?: number;
  readonly maxSizeBytes?: number;
  readonly retryAttempts?: number;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

export interface FetchUrlSuccess {
  readonly ok: true;
  readonly html: string;
  readonly url: string;
  readonly statusCode: number;
  readonly contentType: string;
}

export interface FetchUrlFailure {
  readonly ok: false;
  readonly error: ToolError;
}

export type FetchUrlResult = FetchUrlSuccess | FetchUrlFailure;

// ─── HTML Parser Types ───
export interface ParseHtmlOptions {
  readonly extractOnlySelector?: string;
  readonly removeSelectors?: readonly string[];
  readonly decodeEntities?: boolean;
  readonly normalizeWhitespace?: boolean;
  readonly maxTextLength?: number;
}

export interface ParsedContent {
  readonly title: string;
  readonly description: string;
  readonly text: string;
  readonly language: string;
  readonly images: readonly ImageInfo[];
  readonly videos: readonly VideoInfo[];
  readonly links: readonly LinkInfo[];
}

export interface ImageInfo {
  readonly src: string;
  readonly alt: string;
  readonly title: string;
  readonly width: string;
  readonly height: string;
}

export interface VideoInfo {
  readonly src: string;
  readonly type: string;
  readonly poster: string;
}

export interface LinkInfo {
  readonly href: string;
  readonly text: string;
}

// ─── Web Search Types ───
export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

export interface WebSearchParams {
  readonly query: string;
  readonly freshness?: "day" | "week" | "month" | "year";
  readonly count?: number;
}

// ─── HTTP Client Types ───
export interface HttpResponse<T> {
  readonly success: boolean;
  readonly status: number;
  readonly data: T | null;
  readonly error: string | null;
}

export interface HttpRequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly headers?: Record<string, string>;
}
