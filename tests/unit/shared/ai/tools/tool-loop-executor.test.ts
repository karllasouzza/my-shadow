import { describe, expect, it, beforeEach, mock } from "bun:test";
import type { ToolCall } from "llama.rn";

// Mock ai log to avoid console noise
const mockInfo: string[] = [];
const mockDebug: string[] = [];
const mockError: string[] = [];

mock.module("@/shared/ai/log", () => ({
  aiInfo: (tag: string, msg: string) => {
    mockInfo.push(`${tag}: ${msg}`);
  },
  aiDebug: (tag: string, msg: string) => {
    mockDebug.push(`${tag}: ${msg}`);
  },
  aiError: (tag: string, msg: string) => {
    mockError.push(`${tag}: ${msg}`);
  },
}));

// Helper factories
function makeToolCall(
  name: string,
  params: Record<string, unknown>,
  id?: string,
): ToolCall {
  return {
    id: id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
    type: "function",
    function: {
      name,
      arguments: JSON.stringify(params),
    },
  };
}

function makeCompletionOutput(text: string, tool_calls?: ToolCall[]) {
  return {
    text,
    reasoning: undefined,
    timings: { predicted_n: 10, predicted_ms: 100 } as any,
    tool_calls,
  };
}

function createContext(
  overrides: Record<string, unknown> = {},
) {
  return {
    messages: [],
    tools: [],
    enableThinking: false,
    abortSignal: new AbortController().signal,
    toolOverrides: overrides,
  };
}

/**
 * Creates a stateful completion mock that:
 * - 1st call: returns tool_calls (triggers tool execution)
 * - 2nd+ call: returns final text (no more tools)
 */
function makeSingleIterationComplete(toolCalls: ToolCall[], finalText = "") {
  let callIndex = 0;
  return mock(async () => {
    callIndex++;
    if (callIndex === 1) {
      return {
        success: true as const,
        data: makeCompletionOutput("", toolCalls),
      };
    }
    return {
      success: true as const,
      data: makeCompletionOutput(finalText || `Final response (#${callIndex})`),
    };
  });
}

describe("ToolLoopExecutor", () => {
  let ToolLoopExecutor: any;
  let executor: any;
  let mockOnToolCall: any;

  beforeEach(async () => {
    mockInfo.length = 0;
    mockDebug.length = 0;
    mockError.length = 0;

    const mod = await import(
      "@/shared/ai/tools/tool-loop-executor"
    );
    ToolLoopExecutor = mod.ToolLoopExecutor;
    executor = new ToolLoopExecutor({ enableLogging: false });
    mockOnToolCall = mock(
      async () => ({ success: true, data: { result: "ok" } }),
    );
  });

  // ============ CORE FUNCTIONALITY ============

  it("executes single tool call correctly", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("test_tool", { query: "hello" }),
    ]);
    mockOnToolCall.mockResolvedValue({
      success: true,
      data: { result: "ok" },
    });

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(mockOnToolCall).toHaveBeenCalledWith(
      "test_tool",
      { query: "hello" },
      expect.anything(),
    );
    expect(result.data.toolCallHistory).toHaveLength(1);
    expect(result.data.totalIterations).toBe(2);
  });

  it("returns final text from completion when no tool calls", async () => {
    const complete = mock(async () => ({
      success: true as const,
      data: makeCompletionOutput("Hello, world!"),
    }));

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(result.data.finalCompletion.text).toBe("Hello, world!");
    expect(mockOnToolCall).not.toHaveBeenCalled();
    expect(result.data.totalIterations).toBe(1);
  });

  it("executes multiple tool calls in same iteration", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("tool_a", { id: 1 }),
      makeToolCall("tool_b", { id: 2 }),
      makeToolCall("tool_c", { id: 3 }),
    ]);

    mockOnToolCall.mockImplementation(async (name: string) => {
      return { success: true, data: { name } };
    });

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(mockOnToolCall).toHaveBeenCalledTimes(3);
    expect(result.data.toolCallHistory).toHaveLength(3);
  });

  it("executes multiple iterations when tools return tool calls", async () => {
    let callCount = 0;
    const complete = mock(async () => {
      callCount++;
      if (callCount <= 2) {
        return {
          success: true as const,
          data: makeCompletionOutput(`iteration_${callCount}`, [
            makeToolCall("search", { q: `query_${callCount}` }),
          ]),
        };
      }
      return {
        success: true as const,
        data: makeCompletionOutput("Final answer"),
      };
    });

    mockOnToolCall.mockImplementation(async (_name: string, params: any) => {
      return { success: true, data: { result: params } };
    });

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(result.data.finalCompletion.text).toBe("Final answer");
    expect(result.data.totalIterations).toBe(3);
  });

  // ============ CACHING ============

  it("caches successful results and returns on duplicate call", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("calc", { x: 1 }),
    ]);

    // First execution: cache miss, tool called
    await executor.execute(createContext(), mockOnToolCall, complete);
    expect(mockOnToolCall).toHaveBeenCalledTimes(1);

    // Second execution with same params: cache hit, tool not called again
    const complete2 = makeSingleIterationComplete([
      makeToolCall("calc", { x: 1 }),
    ]);
    await executor.execute(createContext(), mockOnToolCall, complete2);
    expect(mockOnToolCall).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed results (default strategy)", async () => {
    const complete1 = makeSingleIterationComplete([
      makeToolCall("fail", {}),
    ]);
    const complete2 = makeSingleIterationComplete([
      makeToolCall("fail", {}),
    ]);

    mockOnToolCall.mockResolvedValue({ success: false, error: "API error" });

    await executor.execute(createContext(), mockOnToolCall, complete1);
    await executor.execute(createContext(), mockOnToolCall, complete2);

    // Should call twice (no caching of failures) — one per execute call
    expect(mockOnToolCall).toHaveBeenCalledTimes(2);
  });

  it("cache key normalizes object key order", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("search", { a: 1, b: 2 }),
    ]);

    // First call with ordered params
    await executor.execute(createContext(), mockOnToolCall, complete);

    // Second call with same params different key order
    const complete2 = mock(async () => {
      return {
        success: true as const,
        data: makeCompletionOutput("", [makeToolCall("search", { b: 2, a: 1 })]),
      };
    });

    await executor.execute(createContext(), mockOnToolCall, complete2);

    // Should be cache hit (normalized keys) — only 1 tool call total
    expect(mockOnToolCall).toHaveBeenCalledTimes(1);
  });

  // ============ ERROR HANDLING ============

  it("continue-on-error: collects errors but continues execution", async () => {
    executor = new ToolLoopExecutor({
      errorStrategy: "continue-on-error",
      enableLogging: false,
    });

    const complete = makeSingleIterationComplete([
      makeToolCall("ok_tool", {}),
      makeToolCall("fail_tool", {}),
      makeToolCall("ok_tool_2", {}),
    ]);

    mockOnToolCall.mockImplementation((name: string) => {
      if (name === "fail_tool") {
        return Promise.resolve({ success: false, error: "Expected failure" });
      }
      return Promise.resolve({ success: true, data: { ok: true } });
    });

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(result.data.errors).toHaveLength(1);
    expect(result.data.toolCallHistory).toHaveLength(3);
  });

  it("fail-fast: stops on first error", async () => {
    executor = new ToolLoopExecutor({
      errorStrategy: "fail-fast",
      enableLogging: false,
    });

    let callIndex = 0;
    const complete = mock(async () => {
      callIndex++;
      return {
        success: true as const,
        data: makeCompletionOutput("", [
          makeToolCall("ok_tool", {}),
          makeToolCall("fail_tool", {}),
          makeToolCall("never_called", {}),
        ]),
      };
    });

    mockOnToolCall.mockImplementation((name: string) => {
      if (name === "fail_tool") {
        return Promise.resolve({ success: false, error: "Stop here" });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(result.data.errors.length).toBeGreaterThan(0);
  });

  it("handles completion failure on first iteration", async () => {
    const complete = mock(async () => ({
      success: false as const,
      error: { code: "GENERATION_FAILED", message: "Model error" },
    }));

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("GENERATION_FAILED");
  });

  // ============ ABORT SIGNAL ============

  it("respects abort signal mid-execution", async () => {
    const abortController = new AbortController();

    const complete = mock(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        success: true as const,
        data: makeCompletionOutput("", [makeToolCall("slow", {})]),
      };
    });

    mockOnToolCall.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { success: true, data: {} };
    });

    // Abort before execution completes
    setTimeout(() => abortController.abort(), 20);

    const result = await executor.execute(
      {
        ...createContext(),
        abortSignal: abortController.signal,
      },
      mockOnToolCall,
      complete,
    );

    expect(result.data?.wasAborted).toBe(true);
  });

  // ============ DEPENDENCIES & ORDERING ============

  it("respects tool dependency hints for sequential execution", async () => {
    const calls: string[] = [];

    const complete = makeSingleIterationComplete([
      makeToolCall("fetch", { url: "..." }),
      makeToolCall("parse", { source: "fetch" }),
    ]);

    mockOnToolCall.mockImplementation(async (name: string) => {
      calls.push(`start:${name}`);
      await new Promise((r) => setTimeout(r, 10));
      calls.push(`end:${name}`);
      return { success: true, data: { name } };
    });

    await executor.execute(
      {
        ...createContext(),
        toolOverrides: {
          parse: { dependsOn: ["fetch"] },
        },
      },
      mockOnToolCall,
      complete,
    );

    // fetch must complete before parse starts
    const endFetch = calls.indexOf("end:fetch");
    const startParse = calls.indexOf("start:parse");
    expect(endFetch).toBeLessThan(startParse);
  });

  // ============ METRICS & EVENTS ============

  it("emits lifecycle events correctly", async () => {
    const events = {
      onToolStart: mock(() => {}),
      onToolComplete: mock(() => {}),
      onMetrics: mock(() => {}),
    };

    const complete = makeSingleIterationComplete([
      makeToolCall("test", {}),
    ]);

    mockOnToolCall.mockResolvedValue({ success: true, data: {} });

    await executor.execute(createContext(), mockOnToolCall, complete, events);

    expect(events.onToolStart).toHaveBeenCalled();
    expect(events.onToolComplete).toHaveBeenCalled();
    expect(events.onMetrics).toHaveBeenCalled();
  });

  it("collects accurate metrics", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("a", {}),
      makeToolCall("b", {}),
    ]);

    mockOnToolCall.mockResolvedValue({ success: true, data: {} });

    // First run: 2 cache misses
    await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    // Second run with same calls: 2 cache hits
    const complete2 = makeSingleIterationComplete([
      makeToolCall("a", {}),
      makeToolCall("b", {}),
    ]);
    const result2 = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete2,
    );

    const metrics2 = result2.data.metrics;
    expect(metrics2.cacheHits).toBe(2);
    expect(metrics2.toolCallCount).toBe(2);
  });

  it("has correct cache stats", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("a", {}),
    ]);

    mockOnToolCall.mockResolvedValue({ success: true, data: {} });

    await executor.execute(createContext(), mockOnToolCall, complete);

    const stats = executor.getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);
  });

  it("clearCache removes entries", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("a", {}),
    ]);

    mockOnToolCall.mockResolvedValue({ success: true, data: {} });

    await executor.execute(createContext(), mockOnToolCall, complete);
    expect(executor.getCacheStats().size).toBe(1);

    executor.clearCache();
    expect(executor.getCacheStats().size).toBe(0);
  });

  it("clearCache with tool name removes only that tool's entries", async () => {
    const completeA = makeSingleIterationComplete([
      makeToolCall("a", {}),
    ]);
    const completeB = makeSingleIterationComplete([
      makeToolCall("b", {}),
    ]);

    mockOnToolCall.mockResolvedValue({ success: true, data: {} });

    await executor.execute(createContext(), mockOnToolCall, completeA);
    await executor.execute(createContext(), mockOnToolCall, completeB);

    expect(executor.getCacheStats().size).toBe(2);

    executor.clearCache("a");
    expect(executor.getCacheStats().size).toBe(1);
  });

  // ============ EDGE CASES ============

  it("handles empty tool calls gracefully", async () => {
    const complete = mock(async () => ({
      success: true as const,
      data: makeCompletionOutput("Direct response"),
    }));

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(result.data.finalCompletion.text).toBe("Direct response");
    expect(result.data.toolCallHistory).toHaveLength(0);
  });

  it("handles invalid JSON in tool call arguments", async () => {
    const toolCall: ToolCall = {
      id: "call_bad_json",
      type: "function",
      function: {
        name: "bad_tool",
        arguments: "{invalid: json}",
      },
    };

    const complete = makeSingleIterationComplete([toolCall]);

    mockOnToolCall.mockImplementation(async (_name: string, params: any) => {
      // Should receive empty object for invalid JSON
      return { success: true, data: { received: params } };
    });

    await executor.execute(createContext(), mockOnToolCall, complete);

    expect(mockOnToolCall).toHaveBeenCalledWith(
      "bad_tool",
      {},
      expect.anything(),
    );
  });

  it("handles tool returning null (user declined)", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("declined", {}),
    ]);

    mockOnToolCall.mockResolvedValue(null);

    const result = await executor.execute(
      createContext(),
      mockOnToolCall,
      complete,
    );

    expect(result.success).toBe(true);
    expect(result.data.toolCallHistory[0].result.success).toBe(false);
    expect(result.data.toolCallHistory[0].result.error).toContain(
      "declined",
    );
  });
});
