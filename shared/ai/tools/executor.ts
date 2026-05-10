import { aiWarn } from "../log";
import type {
    ExecutionContext,
    ExecutorConfig,
    ToolHandler,
    ToolResult,
} from "./types";
import { DEFAULT_EXECUTOR_CONFIG, toolFail } from "./types";

export async function executeWithRetry(
  handler: ToolHandler,
  params: Record<string, unknown>,
  context: ExecutionContext | undefined,
  config: Partial<ExecutorConfig> = {},
): Promise<ToolResult> {
  const { timeoutMs, maxRetries, baseBackoffMs, maxBackoffMs } = {
    ...DEFAULT_EXECUTOR_CONFIG,
    ...config,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(
        () => handler(params, context),
        timeoutMs,
      );
      return result;
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt >= maxRetries) break;
      const backoff = calculateBackoff(attempt, baseBackoffMs, maxBackoffMs);
      aiWarn(
        "TOOL:executor:retry",
        `attempt=${attempt + 1} backoff=${backoff}ms`,
      );
      await delay(backoff);
    }
  }

  return buildFailureResult(lastError);
}

export function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Execution timed out after ${timeoutMs}ms`);
      (err as unknown as Record<string, unknown>)["code"] = "TIMEOUT";
      reject(err);
    }, timeoutMs);

    fn().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  if (msg.includes("timeout") || msg.includes("network")) return true;
  const status = (error as unknown as Record<string, unknown>)["status"];
  if (status === 429 || status === 502 || status === 503) return true;
  return false;
}

export function calculateBackoff(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * exponential * 0.3;
  return Math.min(Math.floor(exponential + jitter), maxMs);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFailureResult(error: unknown): ToolResult<never> {
  if (!(error instanceof Error)) {
    return toolFail("EXECUTION_FAILED", String(error));
  }
  const code = (error as unknown as Record<string, unknown>)["code"];
  if (code === "TIMEOUT") {
    return toolFail("TIMEOUT", error.message, error);
  }
  if (error.message.toLowerCase().includes("network")) {
    return toolFail("NETWORK_ERROR", error.message, error);
  }
  return toolFail("EXECUTION_FAILED", error.message, error);
}
