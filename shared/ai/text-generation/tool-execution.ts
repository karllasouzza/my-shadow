import { generateUUID } from "@/shared/random-id";
import { aiInfo } from "../log";
import type {
    CompletionOutput,
    GenerateOptions,
    Message,
    Result,
    ToolCall,
    ToolResultForEngine,
} from "./types";
import { fail, ok } from "./types";

interface ToolExecutionResult {
  readonly toolCallId: string;
  readonly result: ToolResultForEngine;
}

export function detectToolCalls(
  tokenToolCalls:
    | { id?: string; function: { name: string; arguments: string } }[]
    | undefined,
  seenIds: Set<string>,
): ToolCall[] {
  if (!tokenToolCalls || tokenToolCalls.length === 0) return [];

  const newCalls: ToolCall[] = [];
  for (const tc of tokenToolCalls) {
    const id = tc.id ?? `tc_${generateUUID().slice(0, 12)}`;
    const sig = `${id}:${tc.function.name}`;
    if (seenIds.has(sig)) continue;
    seenIds.add(sig);
    newCalls.push({
      id,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    });
  }
  return newCalls;
}

export function shouldContinueLoop(
  toolCalls: readonly ToolCall[],
  iteration: number,
  maxIterations: number,
): boolean {
  return toolCalls.length > 0 && iteration < maxIterations;
}

export function buildToolMessages(
  assistantText: string,
  toolCalls: readonly ToolCall[],
  results: readonly ToolExecutionResult[],
): Message[] {
  const messages: Message[] = [];

  // Assistant message with tool_calls
  messages.push({
    role: "assistant",
    content: assistantText || "",
    tool_calls: toolCalls,
  });

  // One "tool" role message per result
  for (const res of results) {
    messages.push({
      role: "tool",
      content: JSON.stringify({
        success: res.result.success,
        data: res.result.data,
        error: res.result.error,
      }),
      tool_call_id: res.toolCallId,
    });
  }

  return messages;
}

export async function executeAllToolCalls(
  toolCalls: readonly ToolCall[],
  onToolCall: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<ToolResultForEngine | null>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult[]> {
  return Promise.all(
    toolCalls.map(async (tc): Promise<ToolExecutionResult> => {
      if (signal?.aborted) {
        return {
          toolCallId: tc.id,
          result: { success: false, error: "Aborted" },
        };
      }

      let parameters: Record<string, unknown>;
      try {
        parameters = JSON.parse(tc.function.arguments) as Record<
          string,
          unknown
        >;
      } catch {
        parameters = {};
      }

      const result = await onToolCall(tc.function.name, parameters);
      if (result === null) {
        return {
          toolCallId: tc.id,
          result: { success: false, error: "User declined tool execution" },
        };
      }

      return { toolCallId: tc.id, result };
    }),
  );
}

export async function runToolPipeline(
  messages: readonly Message[],
  options: GenerateOptions,
  completionFn: (msgs: readonly Message[]) => Promise<Result<CompletionOutput>>,
): Promise<Result<CompletionOutput>> {
  const maxIterations = options.maxToolIterations ?? 3;
  let history: Message[] = [...messages];
  let lastResult: CompletionOutput | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (options.abortSignal?.aborted) {
      return fail("ABORTED", "Generation aborted during tool execution");
    }

    const result = await completionFn(history);
    if (!result.ok) return result;

    lastResult = result.data;

    if (!shouldContinueLoop(result.data.toolCalls, iteration, maxIterations)) {
      break;
    }

    aiInfo(
      "TOOL:pipeline",
      `iteration=${iteration} calls=${result.data.toolCalls.length}`,
      {
        iteration,
        toolNames: result.data.toolCalls.map((tc) => tc.function.name),
      },
    );

    if (options.onToolExecutionStart) {
      options.onToolExecutionStart(
        result.data.toolCalls.map((tc) => tc.function.name),
      );
    }

    if (!options.onToolCall) break;

    const results = await executeAllToolCalls(
      result.data.toolCalls,
      options.onToolCall,
      options.abortSignal,
    );

    const toolMessages = buildToolMessages(
      result.data.text,
      result.data.toolCalls,
      results,
    );
    history = [...history, ...toolMessages];

    if (options.abortSignal?.aborted) {
      return fail("ABORTED", "Generation aborted during tool execution");
    }
  }

  if (!lastResult)
    return fail("EMPTY_RESPONSE", "No completion result generated");
  return ok(lastResult);
}
