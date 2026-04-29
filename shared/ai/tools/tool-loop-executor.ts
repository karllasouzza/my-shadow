import { aiDebug, aiError, aiInfo } from "@/shared/ai/log";
import type { CompletionOutput } from "@/shared/ai/text-generation/types";
import type { Result } from "@/shared/utils/app-error";
import type { ToolCall } from "llama.rn";
import type { ToolDefinition, ToolResult } from "./types";

// ============ CONFIGURATION ============

export type ErrorStrategy =
  | "fail-fast"
  | "continue-on-error"
  | "retry-on-failure";

export interface ToolLoopConfig {
  /** Maximum number of tool call iterations (default: 3) */
  maxIterations?: number;
  /** Enable parallel execution of independent tool calls (default: true) */
  enableParallelExecution?: boolean;
  /** Maximum concurrent tool calls when parallel is enabled (default: 5) */
  maxConcurrency?: number;

  // Caching
  /** Enable result caching for identical tool calls (default: true) */
  enableCaching?: boolean;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number;
  /** Maximum cache entries before LRU eviction (default: 100) */
  maxCacheSize?: number;

  // Error handling
  /** Strategy for handling tool execution errors (default: 'continue-on-error') */
  errorStrategy?: ErrorStrategy;
  /** Default retry attempts for transient failures (default: 1) */
  defaultRetryAttempts?: number;
  /** Default timeout per tool call in ms (default: 30000) */
  defaultTimeoutMs?: number;

  // Observability
  /** Enable structured logging (default: true) */
  enableLogging?: boolean;

  // Security
  /** Sanitize parameters before logging (default: true) */
  sanitizeOutputs?: boolean;
}

export interface ToolLoopContext {
  messages: import("@/database/chat/types").ChatMessage[];
  tools: ToolDefinition[];
  enableThinking: boolean;
  abortSignal: AbortSignal;
  /** Optional per-tool execution overrides */
  toolOverrides?: Record<string, Partial<ToolExecutionConfig>>;
}

export interface ToolExecutionConfig {
  timeoutMs?: number;
  retryAttempts?: number;
  enableCache?: boolean;
  /** When false, tool runs sequentially even in parallel mode */
  runInParallel?: boolean;
  /** Tool names that must complete before this one starts */
  dependsOn?: string[];
}

// ============ RESULT TYPES ============

export interface ToolCallExecution {
  /** Unique execution ID for tracing */
  id: string;
  iteration: number;
  toolCall: ToolCall;
  result: ToolResult;
  durationMs: number;
  wasCached: boolean;
  error?: ExecutionError;
}

export interface ExecutionError {
  toolName: string;
  error: string;
  code?: string;
  retryable: boolean;
  timestamp: number;
}

export interface ToolLoopMetrics {
  totalDurationMs: number;
  iterationCount: number;
  toolCallCount: number;
  cacheHits: number;
  cacheMisses: number;
  parallelExecutions: number;
  errors: number;
  retries: number;
  aborted: boolean;
}

export interface ToolLoopResult {
  finalCompletion: CompletionOutput;
  toolCallHistory: ToolCallExecution[];
  totalIterations: number;
  wasAborted: boolean;
  metrics: ToolLoopMetrics;
  errors: ExecutionError[];
}

// ============ EVENTS ============

export interface ToolLoopEvents {
  onIterationStart?: (iteration: number, toolCalls: ToolCall[]) => void;
  onIterationComplete?: (
    iteration: number,
    executions: ToolCallExecution[],
  ) => void;
  onToolStart?: (execution: ToolCallExecution) => void;
  onToolComplete?: (execution: ToolCallExecution) => void;
  onToolError?: (execution: ToolCallExecution, error: ExecutionError) => void;
  onCacheHit?: (key: string, result: ToolResult) => void;
  onCacheMiss?: (key: string) => void;
  onStreamChunk?: (chunk: { token: string; reasoning?: string }) => void;
  onMetrics?: (metrics: ToolLoopMetrics) => void;
}

// ============ COMPLETION FUNCTION TYPE ============

export type CompletionFunction = (
  messages: import("@/database/chat/types").ChatMessage[],
  options?: {
    enableThinking?: boolean;
    abortSignal?: AbortSignal;
    tools?: ToolDefinition[];
    onStreamChunk?: (chunk: { token: string; reasoning?: string }) => void;
  },
) => Promise<Result<CompletionOutput>>;

// ============ CACHE INTERNALS ============

interface CachedResult {
  result: ToolResult;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Lightweight LRU cache with TTL support.
 * No external dependencies.
 */
class LRUCache<K, V> {
  private map = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map[Symbol.iterator]();
  }

  get size(): number {
    return this.map.size;
  }
}

// ============ EXECUTOR CLASS ============

export class ToolLoopExecutor {
  private cache: LRUCache<string, CachedResult>;
  private metrics: ToolLoopMetrics;
  private readonly config: Required<ToolLoopConfig>;
  private readonly id: string;
  private static nextId = 0;

  constructor(config?: Partial<ToolLoopConfig>) {
    this.id = `exec_${++ToolLoopExecutor.nextId}`;
    this.config = {
      maxIterations: config?.maxIterations ?? 3,
      enableParallelExecution: config?.enableParallelExecution ?? true,
      maxConcurrency: config?.maxConcurrency ?? 5,
      enableCaching: config?.enableCaching ?? true,
      cacheTTL: config?.cacheTTL ?? 5 * 60 * 1000,
      maxCacheSize: config?.maxCacheSize ?? 100,
      errorStrategy: config?.errorStrategy ?? "continue-on-error",
      defaultRetryAttempts: config?.defaultRetryAttempts ?? 1,
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 30000,
      enableLogging: config?.enableLogging ?? true,
      sanitizeOutputs: config?.sanitizeOutputs ?? true,
    };
    this.cache = new LRUCache<string, CachedResult>(this.config.maxCacheSize);
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Execute the tool call loop:
   * 1. Call streamCompletion with context messages
   * 2. If result has tool_calls, execute them (possibly in parallel)
   * 3. Inject tool results into message history
   * 4. Repeat until no more tool_calls or maxIterations reached
   */
  async execute(
    context: ToolLoopContext,
    onToolCall: (
      name: string,
      params: Record<string, unknown>,
      config?: ToolExecutionConfig,
    ) => Promise<ToolResult | null>,
    complete: CompletionFunction,
    events?: ToolLoopEvents,
  ): Promise<
    | {
        success: true;
        data: ToolLoopResult;
      }
    | {
        success: false;
        error: {
          code: string;
          message: string;
          toolCallHistory: ToolCallExecution[];
        };
      }
  > {
    const startTime = Date.now();
    this.metrics = this.createEmptyMetrics();
    const allExecutions: ToolCallExecution[] = [];
    const allErrors: ExecutionError[] = [];
    const history: import("@/database/chat/types").ChatMessage[] = [
      ...context.messages,
    ];
    let finalCompletion: CompletionOutput | null = null;
    let iteration = 0;
    let wasAborted = false;

    this.log(
      "info",
      "TOOL:loop:start",
      `iteration=1 toolCount=${context.tools.length}`,
      {
        maxIterations: this.config.maxIterations,
        parallelMode: this.config.enableParallelExecution,
        concurrencyLimit: this.config.maxConcurrency,
      },
    );

    while (iteration < this.config.maxIterations) {
      if (context.abortSignal.aborted) {
        wasAborted = true;
        break;
      }

      iteration++;
      this.log("debug", "TOOL:iteration:start", `iteration=${iteration}`);

      // Step 1: Get completion from the model
      const completionResult = await complete(history, {
        enableThinking: context.enableThinking,
        abortSignal: context.abortSignal,
        tools: context.tools,
        onStreamChunk: (chunk) => {
          events?.onStreamChunk?.(chunk);
        },
      });

      if (!completionResult.success) {
        this.log(
          "error",
          "TOOL:completion:error",
          `iteration=${iteration} code=${completionResult.error.code}`,
        );
        // If completion fails on first iteration, propagate the error
        if (iteration === 1) {
          return {
            success: false,
            error: {
              code: completionResult.error.code,
              message: completionResult.error.message,
              toolCallHistory: allExecutions,
            },
          };
        }
        // Otherwise use what we have so far
        break;
      }

      finalCompletion = completionResult.data;

      // No tool calls — this is the final response
      if (
        !finalCompletion.tool_calls ||
        finalCompletion.tool_calls.length === 0
      ) {
        this.log(
          "debug",
          "TOOL:iteration:no-tools",
          `iteration=${iteration} — final response`,
        );
        break;
      }

      const toolCalls = finalCompletion.tool_calls;
      events?.onIterationStart?.(iteration, toolCalls);

      this.log(
        "info",
        "TOOL:tool:count",
        `iteration=${iteration} toolCalls=${toolCalls.length}`,
        {
          toolNames: toolCalls.map((tc) => tc.function.name),
        },
      );

      // Step 2: Execute tool calls (possibly in parallel)
      const executions = await this.executeToolCalls(
        toolCalls,
        iteration,
        context,
        onToolCall,
        events,
      );

      allExecutions.push(...executions);
      this.metrics.toolCallCount += executions.length;

      // Collect errors
      for (const exec of executions) {
        if (exec.error) {
          allErrors.push(exec.error);
          this.metrics.errors++;
        }
      }

      events?.onIterationComplete?.(iteration, executions);

      // Step 3: Inject tool results into message history
      for (const exec of executions) {
        if (context.abortSignal.aborted) {
          wasAborted = true;
          break;
        }

        const resultContent = JSON.stringify({
          success: exec.result.success,
          data: exec.result.data,
          error: exec.result.error,
          source: exec.result.source,
        });

        history.push({
          id: `tool_msg_${exec.id}`,
          role: "tool",
          content: resultContent,
          tool_call_id: exec.toolCall.id,
          createdAt: new Date().toISOString(),
        });
      }

      // Check error strategy
      if (
        this.config.errorStrategy === "fail-fast" &&
        executions.some((e) => e.error)
      ) {
        this.log(
          "warn",
          "TOOL:fail-fast",
          `iteration=${iteration} — stopping due to tool errors`,
        );
        break;
      }

      if (wasAborted) break;
    }

    // Final completion after loop ends
    if (!wasAborted && context.abortSignal.aborted) {
      wasAborted = true;
    }

    if (!finalCompletion && iteration === 0) {
      // Should not happen, but handle gracefully
      return {
        success: false,
        error: {
          code: "NO_COMPLETION",
          message: "No completion was generated",
          toolCallHistory: allExecutions,
        },
      };
    }

    const totalDuration = Date.now() - startTime;
    this.metrics.totalDurationMs = totalDuration;
    this.metrics.iterationCount = iteration;
    this.metrics.aborted = wasAborted;

    this.log(
      "info",
      "TOOL:loop:metrics",
      `iterations=${iteration} tools=${this.metrics.toolCallCount} cacheHits=${this.metrics.cacheHits} duration=${totalDuration}ms`,
      this.collectMetrics() as unknown as Record<string, unknown>,
    );

    events?.onMetrics?.(this.metrics);

    return {
      success: true,
      data: {
        finalCompletion: finalCompletion!,
        toolCallHistory: allExecutions,
        totalIterations: iteration,
        wasAborted,
        metrics: this.metrics,
        errors: allErrors,
      },
    };
  }

  /**
   * Execute tool calls with parallel support and dependency resolution.
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    iteration: number,
    context: ToolLoopContext,
    onToolCall: (
      name: string,
      params: Record<string, unknown>,
      config?: ToolExecutionConfig,
    ) => Promise<ToolResult | null>,
    events?: ToolLoopEvents,
  ): Promise<ToolCallExecution[]> {
    // Resolve execution order based on dependencies
    const executionBatches = this.resolveExecutionOrder(
      toolCalls,
      context.toolOverrides ?? {},
    );

    const allExecutions: ToolCallExecution[] = [];

    for (const batch of executionBatches) {
      if (context.abortSignal.aborted) break;

      if (this.config.enableParallelExecution && batch.length > 1) {
        // Execute batch in parallel with concurrency limit
        this.metrics.parallelExecutions++;
        const batchResults = await this.executeWithConcurrencyLimit(
          batch,
          async (toolCall) => {
            return await this.executeToolCallWithIsolation(
              toolCall,
              iteration,
              context,
              onToolCall,
              events,
            );
          },
          this.config.maxConcurrency,
        );
        allExecutions.push(...batchResults.filter(Boolean));
      } else {
        // Execute batch sequentially
        for (const toolCall of batch) {
          if (context.abortSignal.aborted) break;
          const execution = await this.executeToolCallWithIsolation(
            toolCall,
            iteration,
            context,
            onToolCall,
            events,
          );
          allExecutions.push(execution);
        }
      }
    }

    return allExecutions;
  }

  /**
   * Execute a single tool call with error isolation, caching, timeout, and retry.
   */
  private async executeToolCallWithIsolation(
    toolCall: ToolCall,
    iteration: number,
    context: ToolLoopContext,
    onToolCall: (
      name: string,
      params: Record<string, unknown>,
      config?: ToolExecutionConfig,
    ) => Promise<ToolResult | null>,
    events?: ToolLoopEvents,
  ): Promise<ToolCallExecution> {
    const execId = `${this.id}_${iteration}_${toolCall.function.name}_${Date.now()}`;
    const toolConfig = context.toolOverrides?.[toolCall.function.name] ?? {};

    let parameters: Record<string, unknown>;
    try {
      parameters = JSON.parse(toolCall.function.arguments);
    } catch {
      parameters = {};
    }

    const execution: ToolCallExecution = {
      id: execId,
      iteration,
      toolCall,
      result: { success: false, error: "Not executed" },
      durationMs: 0,
      wasCached: false,
    };

    // Check cache
    if (this.config.enableCaching && toolConfig.enableCache !== false) {
      const cacheKey = this.buildCacheKey(toolCall.function.name, parameters);
      const cached = this.getCachedResult(cacheKey, toolConfig, events);
      if (cached) {
        this.metrics.cacheHits++;
        return {
          ...execution,
          result: cached,
          wasCached: true,
          durationMs: 0,
        };
      }
      this.metrics.cacheMisses++;
    }

    events?.onToolStart?.(execution);

    const sanitizedParams = this.config.sanitizeOutputs
      ? this.sanitizeParams(parameters)
      : parameters;

    const timeoutMs = toolConfig.timeoutMs ?? this.config.defaultTimeoutMs;
    const maxRetries =
      toolConfig.retryAttempts ?? this.config.defaultRetryAttempts;

    this.log(
      "debug",
      "TOOL:tool:executing",
      `id=${execId} name=${toolCall.function.name}`,
      { params: sanitizedParams, timeoutMs, maxRetries },
    );

    let attempt = 0;
    let lastError: ExecutionError | null = null;

    while (attempt <= maxRetries) {
      attempt++;
      const attemptStart = Date.now();

      if (attempt > 1) {
        this.metrics.retries++;
        // Exponential backoff with jitter before retry
        const delay = this.computeRetryDelay(attempt);
        this.log(
          "warn",
          "TOOL:tool:retry",
          `id=${execId} name=${toolCall.function.name} attempt=${attempt}/${maxRetries + 1} delay=${delay}ms`,
          { retryDelay: delay, code: lastError?.code },
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        const result = await this.executeWithTimeout(
          () => onToolCall(toolCall.function.name, parameters, toolConfig),
          timeoutMs,
        );

        execution.durationMs = Date.now() - attemptStart;
        execution.result = result ?? {
          success: false,
          error: "User declined tool execution",
        };

        if (result?.success) {
          this.log(
            "debug",
            "TOOL:tool:complete",
            `id=${execId} name=${toolCall.function.name} duration=${execution.durationMs}ms`,
          );

          // Cache successful result
          if (this.config.enableCaching && toolConfig.enableCache !== false) {
            const cacheKey = this.buildCacheKey(
              toolCall.function.name,
              parameters,
            );
            this.setCachedResult(cacheKey, result, toolConfig);
          }
        } else if (result === null) {
          this.log(
            "debug",
            "TOOL:tool:declined",
            `id=${execId} name=${toolCall.function.name}`,
          );
        } else {
          const errMsg = result?.error ?? "Tool returned no result";
          lastError = {
            toolName: toolCall.function.name,
            error: errMsg,
            code: "TOOL_ERROR",
            retryable: false,
            timestamp: Date.now(),
          };
          execution.error = lastError;
          execution.result = {
            success: false,
            error: errMsg,
          };

          this.log(
            "warn",
            "TOOL:tool:error",
            `id=${execId} name=${toolCall.function.name} error=${errMsg}`,
          );

          // Non-successful result from tool (not an exception) — do not retry
          break;
        }

        events?.onToolComplete?.(execution);
        return execution;
      } catch (error) {
        execution.durationMs = Date.now() - attemptStart;
        const errMsg = error instanceof Error ? error.message : String(error);
        const isTimeout =
          error instanceof TimeoutError ||
          (error instanceof Error && error.name === "TimeoutError");
        const errorCode = isTimeout ? "TIMEOUT" : "EXECUTION_ERROR";

        lastError = {
          toolName: toolCall.function.name,
          error: errMsg,
          code: errorCode,
          retryable: this.shouldRetry(errorCode),
          timestamp: Date.now(),
        };

        this.log(
          "error",
          "TOOL:tool:fatal",
          `id=${execId} name=${toolCall.function.name} attempt=${attempt}/${maxRetries + 1} error=${errMsg} code=${errorCode}`,
        );

        if (!lastError.retryable || attempt > maxRetries) {
          // Final failure — surface the error
          execution.error = lastError;
          execution.result = {
            success: false,
            error: errMsg,
          };
          events?.onToolError?.(execution, execution.error);
          break;
        }
      }
    }

    return execution;
  }

  /** Determine if an error code is retryable. */
  private shouldRetry(code: string): boolean {
    const retryableCodes = [
      "NETWORK_ERROR",
      "TIMEOUT",
      "ECONNRESET",
      "ETIMEDOUT",
      "429",
      "502",
      "503",
    ];
    return retryableCodes.includes(code);
  }

  /** Compute retry delay with exponential backoff and jitter (max 5s). */
  private computeRetryDelay(attempt: number): number {
    const base = 1000; // 1s base delay
    const exponential = base * Math.pow(2, attempt - 2); // attempt-2 because attempt starts at 1
    const jitter = Math.random() * exponential * 0.3;
    return Math.min(Math.floor(exponential + jitter), 5000);
  }

  /**
   * Execute a function with a timeout.
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new TimeoutError()), timeoutMs);
      }),
    ]);
  }

  // ============ PARALLEL EXECUTION ============

  /**
   * Execute an array of tool calls with concurrency limit.
   */
  private async executeWithConcurrencyLimit<T>(
    items: ToolCall[],
    executor: (item: ToolCall) => Promise<T>,
    limit: number,
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const p = executor(item).then((result) => {
        results.push(result);
      });
      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Resolve execution order based on dependency hints.
   * Returns batches of tool calls that can be executed in parallel.
   */
  private resolveExecutionOrder(
    toolCalls: ToolCall[],
    overrides: Record<string, Partial<ToolExecutionConfig>>,
  ): ToolCall[][] {
    // Build dependency graph
    const graph = new Map<string, { deps: Set<string>; call: ToolCall }>();

    for (const call of toolCalls) {
      const name = call.function.name;
      const config = overrides[name];
      const deps = new Set(config?.dependsOn ?? []);
      graph.set(name, { deps, call });
    }

    // Topological sort for dependency resolution
    const batches: ToolCall[][] = [];
    const remaining = new Set(graph.keys());

    while (remaining.size > 0) {
      // Find tools with all dependencies satisfied
      const ready: ToolCall[] = [];

      for (const name of remaining) {
        const node = graph.get(name)!;
        const depsSatisfied = [...node.deps].every(
          (dep) => !remaining.has(dep),
        );

        if (depsSatisfied) {
          const config = overrides[name];
          if (config?.runInParallel === false) {
            // Run sequentially: each gets own batch
            batches.push([node.call]);
            remaining.delete(name);
          } else {
            ready.push(node.call);
          }
        }
      }

      if (ready.length > 0) {
        batches.push(ready);
        ready.forEach((call) => remaining.delete(call.function.name));
      } else if (remaining.size > 0) {
        // Cycle detected or unresolvable deps: fallback to sequential
        for (const name of remaining) {
          batches.push([graph.get(name)!.call]);
        }
        break;
      }
    }

    return batches;
  }

  // ============ CACHING ============

  private buildCacheKey(name: string, params: Record<string, unknown>): string {
    const normalized = this.normalizeParamsForCache(params);
    return `${name}:${normalized}`;
  }

  private normalizeParamsForCache(params: Record<string, unknown>): string {
    return JSON.stringify(params, (_key, value) =>
      value instanceof Object && !(value instanceof Array)
        ? Object.keys(value)
            .sort()
            .reduce(
              (acc, k) => ({
                ...acc,
                [k]: (value as Record<string, unknown>)[k],
              }),
              {} as Record<string, unknown>,
            )
        : value,
    );
  }

  private getCachedResult(
    key: string,
    toolConfig?: Partial<ToolExecutionConfig>,
    events?: ToolLoopEvents,
  ): ToolResult | null {
    if (!this.config.enableCaching || toolConfig?.enableCache === false) {
      return null;
    }

    const cached = this.cache.get(key);
    if (!cached) {
      this.log("debug", "TOOL:cache:miss", `key=${key}`);
      events?.onCacheMiss?.(key);
      return null;
    }

    // Check TTL
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.log("debug", "TOOL:cache:expired", `key=${key}`);
      return null;
    }

    // Update LRU metadata
    cached.accessCount++;
    cached.lastAccessed = Date.now();
    this.log(
      "debug",
      "TOOL:cache:hit",
      `key=${key} accesses=${cached.accessCount}`,
    );
    events?.onCacheHit?.(key, cached.result);

    return cached.result;
  }

  private setCachedResult(
    key: string,
    result: ToolResult,
    toolConfig?: Partial<ToolExecutionConfig>,
  ): void {
    if (!this.config.enableCaching || toolConfig?.enableCache === false) {
      return;
    }

    // Don't cache failures (unless retry strategy says otherwise)
    if (!result.success && this.config.errorStrategy !== "retry-on-failure") {
      return;
    }

    const ttl = toolConfig?.timeoutMs ?? this.config.cacheTTL;

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  // ============ PUBLIC UTILITY METHODS ============

  /** Clear the entire cache or for a specific tool. */
  clearCache(toolName?: string): void {
    if (toolName) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${toolName}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
    this.log("info", "TOOL:cache:cleared", `toolName=${toolName ?? "all"}`);
  }

  /** Get current cache statistics. */
  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
    };
  }

  // ============ PRIVATE HELPERS ============

  private createEmptyMetrics(): ToolLoopMetrics {
    return {
      totalDurationMs: 0,
      iterationCount: 0,
      toolCallCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      parallelExecutions: 0,
      errors: 0,
      retries: 0,
      aborted: false,
    };
  }

  private collectMetrics(): ToolLoopMetrics {
    return { ...this.metrics };
  }

  private sanitizeParams(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.length > 100) {
        sanitized[key] = `${value.slice(0, 100)}...`;
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    event: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (!this.config.enableLogging) return;

    const logEntry = {
      executorId: this.id,
      ...data,
    };

    switch (level) {
      case "debug":
        aiDebug(event, message, logEntry);
        break;
      case "info":
        aiInfo(event, message, logEntry);
        break;
      case "warn":
        console.warn(`[tool-loop] ${event} — ${message}`, logEntry);
        break;
      case "error":
        aiError(event, message, logEntry);
        break;
    }
  }
}

/** Internal error class for timeouts. */
class TimeoutError extends Error {
  constructor() {
    super("Tool execution timed out");
    this.name = "TimeoutError";
  }
}
