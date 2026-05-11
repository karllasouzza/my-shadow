import type { LlamaContext } from "llama.rn";
import { aiDebug, aiInfo } from "../log";
import { STOP_WORDS } from "./constants";
import { createThinkingState, processThinkingToken } from "./thinking";
import { detectToolCalls } from "./tool-execution";
import {
  CompletionOutput,
  CompletionTimings,
  ContextConfig,
  GenerateOptions,
  Message,
  StreamAccumulator,
  StreamEvent,
  ThinkingState,
  fail,
  ok,
  type Result,
} from "./types";

export function createAccumulator(): StreamAccumulator {
  return {
    text: "",
    reasoning: "",
    toolCalls: [],
    seenToolCallIds: new Set(),
    ttftMs: null,
    startTime: Date.now(),
  };
}

export function createStreamConfig(
  messages: readonly Message[],
  options: GenerateOptions,
  _config: ContextConfig,
  toolDefinitions?: unknown[],
): Record<string, unknown> {
  const streamConfig: Record<string, unknown> = {
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls && m.tool_calls.length > 0
        ? { tool_calls: m.tool_calls }
        : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    })),
    jinja: true,
    enable_thinking: options.enableThinking ?? false,
    thinking_forced_open: options.enableThinking ?? false,
    n_predict: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    stop: STOP_WORDS,
    top_p: 0.95,
    top_k: 64,
    penalty_freq: 0.5,
    penalty_last_n: 64,
    flash_attn: _config.flash_attn,
  };

  if (toolDefinitions && toolDefinitions.length > 0) {
    streamConfig.tools = toolDefinitions;
    streamConfig.tool_choice = "auto";
    streamConfig.flash_attn = false;
  }

  return streamConfig;
}

interface TokenData {
  token: string;
  reasoning_content?: string;
  tool_calls?: {
    id?: string;
    function: { name: string; arguments: string };
  }[];
}

export function processTokenChunk(
  tokenData: TokenData,
  accumulator: StreamAccumulator,
  thinkingState: ThinkingState,
  enableThinking: boolean,
): StreamEvent[] {
  const events: StreamEvent[] = [];
  const token = tokenData.token ?? "";
  const reasoningContent = tokenData.reasoning_content ?? "";

  // Record TTFT on first token
  if (accumulator.ttftMs === null && (token || reasoningContent)) {
    accumulator.ttftMs = Date.now() - accumulator.startTime;
  }

  // Handle native reasoning_content field (model-native thinking)
  if (reasoningContent) {
    accumulator.reasoning += reasoningContent;
    events.push({ type: "thinking", token: reasoningContent });
  }

  // Check for tool calls in token data
  if (tokenData.tool_calls && tokenData.tool_calls.length > 0) {
    const newCalls = detectToolCalls(
      tokenData.tool_calls,
      accumulator.seenToolCallIds,
    );
    for (const call of newCalls) {
      accumulator.toolCalls.push(call);
      events.push({ type: "tool_call", call });
    }
  }

  // Process text token through thinking pipeline
  if (token) {
    const thinkEvent = processThinkingToken(
      token,
      thinkingState,
      enableThinking,
    );
    if (thinkEvent) {
      events.push(thinkEvent);
    } else {
      accumulator.text += token;
      events.push({ type: "text", token });
    }
  }

  return events;
}

interface RawTimings {
  prompt_n?: number;
  predicted_n?: number;
  predicted_ms?: number;
  prompt_ms?: number;
}

export function collectOutput(
  accumulator: StreamAccumulator,
  thinkingState: ThinkingState,
  timingsData?: RawTimings,
): CompletionOutput {
  const timings: CompletionTimings | null = timingsData
    ? {
        promptTokens: timingsData.prompt_n ?? 0,
        generatedTokens: timingsData.predicted_n ?? 0,
        totalMs: (timingsData.predicted_ms ?? 0) + (timingsData.prompt_ms ?? 0),
        tokensPerSecond:
          timingsData.predicted_ms && timingsData.predicted_n
            ? (timingsData.predicted_n / timingsData.predicted_ms) * 1000
            : 0,
        timeToFirstToken: accumulator.ttftMs ?? 0,
      }
    : null;

  const reasoning = thinkingState.reasoning || accumulator.reasoning || null;

  return {
    text: accumulator.text,
    reasoning,
    timings,
    toolCalls: accumulator.toolCalls,
  };
}

export async function runStream(
  context: LlamaContext,
  messages: readonly Message[],
  options: GenerateOptions,
  config: ContextConfig,
  toolDefinitions?: unknown[],
  onStop?: (stop: () => void) => void,
): Promise<Result<CompletionOutput>> {
  const accumulator = createAccumulator();
  const thinkingState = createThinkingState();
  const streamConfig = createStreamConfig(
    messages,
    options,
    config,
    toolDefinitions,
  );
  const enableThinking = options.enableThinking ?? false;

  aiDebug("STREAM:start", `messages=${messages.length}`, {
    enableThinking,
    maxTokens: options.maxTokens ?? 2048,
  });

  try {
    const { promise, stop } = await context.parallel.completion(
      streamConfig,
      (_slotId: number, tokenData: TokenData) => {
        if (options.abortSignal?.aborted) return;

        const events = processTokenChunk(
          tokenData,
          accumulator,
          thinkingState,
          enableThinking,
        );

        for (const event of events) {
          options.onEvent?.(event);
        }
      },
    );

    // Expose stop function to the engine
    if (onStop) {
      onStop(stop);
    }

    // Store stop function for external access (engine sets this)
    if (options.abortSignal) {
      const abortHandler = () => {
        stop();
      };
      options.abortSignal.addEventListener("abort", abortHandler, {
        once: true,
      });
    }

    const result = await promise;

    if (options.abortSignal?.aborted) {
      return fail("ABORTED", "Generation aborted");
    }

    // Prefer final result tool_calls over streamed ones
    const finalToolCalls = result.tool_calls as
      | { id?: string; function: { name: string; arguments: string } }[]
      | undefined;

    if (finalToolCalls && finalToolCalls.length > 0) {
      const newCalls = detectToolCalls(
        finalToolCalls,
        accumulator.seenToolCallIds,
      );
      for (const call of newCalls) {
        accumulator.toolCalls.push(call);
      }
    }

    const output = collectOutput(
      accumulator,
      thinkingState,
      result.timings as RawTimings | undefined,
    );

    aiInfo("STREAM:done", `tokens=${output.timings?.generatedTokens ?? 0}`, {
      textLen: output.text.length,
      toolCalls: output.toolCalls.length,
      hasReasoning: !!output.reasoning,
    });

    options.onEvent?.({ type: "done", output });
    return ok(output);
  } catch (error) {
    if (
      options.abortSignal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return fail("ABORTED", "Generation aborted");
    }

    aiDebug("STREAM:error", `${(error as Error)?.message}`);
    return fail("GENERATION_FAILED", "Stream completion failed", error);
  }
}
