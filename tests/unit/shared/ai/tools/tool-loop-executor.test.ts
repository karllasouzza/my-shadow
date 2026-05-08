import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ToolCall } from "llama.rn";
import type { ChatMessage } from "@/database/chat/types";
import {
  runToolLoop,
  type CompletionFunction,
  type ToolLoopOptions,
} from "@/shared/ai/text-generation/tool-loop";

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

function makeOptions(
  overrides: Partial<ToolLoopOptions> = {},
): ToolLoopOptions {
  return {
    onToolCall: mock(async () => ({ success: true, data: { result: "ok" } })),
    ...overrides,
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
  }) as CompletionFunction;
}

describe("runToolLoop", () => {
  let mockOnToolCall: any;

  beforeEach(() => {
    mockOnToolCall = mock(async () => ({
      success: true,
      data: { result: "ok" },
    }));
  });

  // ============ CORE FUNCTIONALITY ============

  it("executes single tool call correctly", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("test_tool", { query: "hello" }),
    ]);

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
    expect(mockOnToolCall).toHaveBeenCalledWith("test_tool", { query: "hello" });
  });

  it("returns final text from completion when no tool calls", async () => {
    const complete = mock(async () => ({
      success: true as const,
      data: makeCompletionOutput("Hello, world!"),
    })) as CompletionFunction;

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
    expect((result as any).data.text).toBe("Hello, world!");
    expect(mockOnToolCall).not.toHaveBeenCalled();
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

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
    expect(mockOnToolCall).toHaveBeenCalledTimes(3);
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
    }) as CompletionFunction;

    mockOnToolCall.mockImplementation(async (_name: string, params: any) => {
      return { success: true, data: { result: params } };
    });

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
    expect((result as any).data.text).toBe("Final answer");
    expect(mockOnToolCall).toHaveBeenCalledTimes(2);
  });

  // ============ ERROR HANDLING ============

  it("continues execution when a tool fails", async () => {
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

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
    expect(mockOnToolCall).toHaveBeenCalledTimes(3);
  });

  it("handles completion failure on first iteration", async () => {
    const complete = mock(async () => ({
      success: false as const,
      error: { code: "GENERATION_FAILED", message: "Model error" },
    })) as CompletionFunction;

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(false);
    expect((result as any).error.code).toBe("GENERATION_FAILED");
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
    }) as CompletionFunction;

    mockOnToolCall.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { success: true, data: {} };
    });

    setTimeout(() => abortController.abort(), 20);

    const result = await runToolLoop(
      [],
      makeOptions({
        onToolCall: mockOnToolCall,
        abortSignal: abortController.signal,
      }),
      complete,
    );

    expect(result.success).toBe(false);
    expect((result as any).error.code).toBe("ABORTED");
  });

  // ============ MESSAGE HISTORY ============

  it("injects assistant message with tool_calls before tool results", async () => {
    const complete = makeSingleIterationComplete([
      makeToolCall("test", {}),
    ]);

    const history: ChatMessage[] = [
      { id: "user_1", role: "user", content: "hi", createdAt: new Date().toISOString() },
    ];

    await runToolLoop(history, makeOptions({ onToolCall: mockOnToolCall }), complete);

    // Verify that complete was called with updated history on second iteration
    expect(complete).toHaveBeenCalledTimes(2);
    const secondCallHistory = (complete as any).mock.calls[1][0] as ChatMessage[];
    expect(secondCallHistory).toHaveLength(3);
    expect(secondCallHistory[1].role).toBe("assistant");
    expect(secondCallHistory[1].tool_calls).toBeDefined();
    expect(secondCallHistory[2].role).toBe("tool");
    expect(secondCallHistory[2].tool_call_id).toBeDefined();
  });

  // ============ EDGE CASES ============

  it("handles empty tool calls gracefully", async () => {
    const complete = mock(async () => ({
      success: true as const,
      data: makeCompletionOutput("Direct response"),
    })) as CompletionFunction;

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
    expect((result as any).data.text).toBe("Direct response");
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
      return { success: true, data: { received: params } };
    });

    await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(mockOnToolCall).toHaveBeenCalledWith("bad_tool", {});
  });

  it("handles tool returning null (user declined)", async () => {
    const complete = makeSingleIterationComplete([makeToolCall("declined", {})]);

    mockOnToolCall.mockResolvedValue(null);

    const result = await runToolLoop([], makeOptions({ onToolCall: mockOnToolCall }), complete);

    expect(result.success).toBe(true);
  });

  it("emits onToolExecutionStart callback", async () => {
    const onToolExecutionStart = mock(() => {});
    const complete = makeSingleIterationComplete([makeToolCall("test", {})]);

    await runToolLoop(
      [],
      makeOptions({ onToolCall: mockOnToolCall, onToolExecutionStart }),
      complete,
    );

    expect(onToolExecutionStart).toHaveBeenCalledWith(["test"]);
  });
});
