import type { ChatMessage } from "@/database/chat/types";
import type { ToolResult } from "@/shared/ai/tools/types";
import { createError, err, ok, type Result } from "@/shared/utils/app-error";
import type { ToolCall } from "llama.rn";
import type {
  CompletionOutput,
  RunToolLoopParams,
  ToolLoopOptions,
} from "./types";

export async function runToolLoop({
  messages,
  options,
  onComplete,
}: RunToolLoopParams): Promise<Result<CompletionOutput>> {
  const maxIterations = options.maxIterations ?? 3;
  const history: ChatMessage[] = [...messages];
  let finalCompletion: CompletionOutput | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (options.abortSignal?.aborted) {
      return err(createError("ABORTED", "Geração cancelada."));
    }

    const completionResult = await onComplete(history);

    if (!completionResult.success) {
      if (iteration === 0) {
        return completionResult;
      }
      break;
    }

    finalCompletion = completionResult.data;

    if (
      !finalCompletion.tool_calls ||
      finalCompletion.tool_calls.length === 0
    ) {
      break;
    }

    const toolCalls = finalCompletion.tool_calls;
    options.onToolExecutionStart?.(toolCalls.map((tc) => tc.function.name));

    const results = await executeToolCalls(toolCalls, options);

    // Add assistant message with tool_calls (required by LLaMA Jinja template)
    history.push({
      id: `assistant_tool_${iteration}`,
      role: "assistant",
      content: finalCompletion.text || "",
      tool_calls: toolCalls,
      createdAt: new Date().toISOString(),
    });

    // Inject tool results into message history
    for (const res of results) {
      if (options.abortSignal?.aborted) break;
      history.push({
        id: `tool_msg_${res.toolCallId}`,
        role: "tool",
        content: JSON.stringify({
          success: res.result.success,
          data: res.result.data,
          error: res.result.error,
          source: res.result.source,
        }),
        tool_call_id: res.toolCallId,
        createdAt: new Date().toISOString(),
      });
    }

    if (options.abortSignal?.aborted) {
      return err(createError("ABORTED", "Geração cancelada."));
    }
  }

  if (!finalCompletion) {
    return err(createError("EMPTY", "No completion was generated."));
  }

  return ok(finalCompletion);
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  options: ToolLoopOptions,
): Promise<{ toolCallId: string; result: ToolResult }[]> {
  return Promise.all(
    toolCalls.map(async (tc) => {
      let parameters: Record<string, unknown>;
      try {
        parameters = JSON.parse(tc.function.arguments);
      } catch {
        parameters = {};
      }

      const override = options.toolOverrides?.[tc.function.name];
      const result = await executeSingleTool(
        tc.function.name,
        parameters,
        options.onToolCall,
        options.abortSignal,
        override?.timeoutMs,
        override?.maxRetries,
      );

      return {
        toolCallId: tc.id ?? `tc_${Date.now()}`,
        result,
      };
    }),
  );
}

async function executeSingleTool(
  name: string,
  params: Record<string, unknown>,
  onToolCall: ToolLoopOptions["onToolCall"],
  abortSignal?: AbortSignal,
  timeoutMs = 30000,
  maxRetries = 2,
): Promise<ToolResult> {
  const retryableCodes = new Set([
    "NETWORK_ERROR",
    "TIMEOUT",
    "ECONNRESET",
    "ETIMEDOUT",
    "429",
    "502",
    "503",
  ]);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortSignal?.aborted) {
      return { success: false, error: "Aborted" };
    }

    try {
      const result = await withTimeout(
        () => onToolCall(name, params),
        timeoutMs,
      );

      if (result === null) {
        return { success: false, error: "User declined tool execution" };
      }

      if (result.success) {
        return result;
      }

      const errorCode = result.errorCode ?? "TOOL_ERROR";
      if (!retryableCodes.has(errorCode) || attempt === maxRetries) {
        return result;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await sleep(delay);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      const errorCode = isTimeout ? "TIMEOUT" : "EXECUTION_ERROR";

      if (!retryableCodes.has(errorCode) || attempt === maxRetries) {
        return { success: false, error: errMsg };
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await sleep(delay);
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new TimeoutError()), timeoutMs);
    }),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TimeoutError extends Error {
  constructor() {
    super("Tool execution timed out");
    this.name = "TimeoutError";
  }
}
