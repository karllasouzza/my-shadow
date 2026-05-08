import { ChatMessage } from "@/database/chat/types";
import { aiError, aiInfo } from "@/shared/ai/log";
import { getAIRuntime } from "@/shared/ai/text-generation/runtime";
import type { CompletionOutput } from "@/shared/ai/text-generation/types";
import type { ToolDefinition, ToolResult } from "@/shared/ai/tools/types";
import { generateUUID } from "@/shared/random-id";
import type { NativeCompletionResultTimings } from "llama.rn";
import { useCallback, useMemo, useRef, useState } from "react";

export interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
}

interface GenerateOptions {
  modelId: string;
  enableThinking: boolean;
  tools?: ToolDefinition[];
  onUpdate?: (content: string, reasoning: string) => void;
  onComplete?: (
    content: string,
    reasoning?: string,
    messageId?: string,
    timings?: NativeCompletionResultTimings,
  ) => void;
  onError?: (
    code: string,
    partialContent?: string,
    partialReasoning?: string,
    messageId?: string,
  ) => void;
  /** Called when the model requests a tool call. Return the tool result or null to decline. */
  onToolCall?: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<ToolResult | null>;
}

export function useStreamingGeneration() {
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef("");
  const reasoningRef = useRef("");

  const clearStreamingState = useCallback(() => {
    setStreaming(null);
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async (messages: ChatMessage[], options: GenerateOptions) => {
      const abortController = new AbortController();
      abortRef.current = abortController;
      contentRef.current = "";
      reasoningRef.current = "";

      // Create initial streaming message with fixed timestamp
      const createdAtTimestamp = new Date().toISOString();
      const initialMessage: StreamingMessage = {
        id: generateUUID(),
        role: "assistant",
        content: "",
        reasoning_content: "",
        modelId: options.modelId,
        createdAt: createdAtTimestamp,
        updatedAt: createdAtTimestamp,
        _isStreaming: true,
      };

      setStreaming(initialMessage);
      setIsGenerating(true);

      aiInfo("INFERENCE:ui:start", `messageId=${initialMessage.id}`, {
        modelId: options.modelId,
        messageId: initialMessage.id,
      });

      // Run the full generation with tool call support
      const result = await generateWithTools(
        messages,
        options,
        abortController,
        initialMessage,
        (updated: StreamingMessage) => setStreaming(updated),
        contentRef,
        reasoningRef,
      );

      abortRef.current = null;

      if (abortController.signal.aborted) {
        aiInfo("INFERENCE:ui:aborted", `messageId=${initialMessage.id}`);
        clearStreamingState();
        options.onError?.(
          "ABORTED",
          contentRef.current,
          reasoningRef.current,
          initialMessage.id,
        );
        return;
      }

      if (!result.success) {
        aiError(
          "INFERENCE:ui:error",
          `messageId=${initialMessage.id} code=${result.error?.code}`,
        );
        clearStreamingState();
        options.onError?.(
          result.error?.code ?? "GENERATION_FAILED",
          contentRef.current,
          reasoningRef.current,
          initialMessage.id,
        );
        return;
      }

      // Save final message to state
      const finalMessage: ChatMessage = {
        id: initialMessage.id,
        role: "assistant",
        content: result.data.text || contentRef.current,
        reasoning_content:
          result.data.reasoning || reasoningRef.current || undefined,
        timings: result.data.timings,
        modelId: options.modelId,
        createdAt: initialMessage.createdAt,
        updatedAt: new Date().toISOString(),
      };

      clearStreamingState();
      aiInfo("INFERENCE:ui:complete", `messageId=${initialMessage.id}`, {
        messageId: initialMessage.id,
        timings: result.data.timings,
      });
      options.onComplete?.(
        finalMessage.content,
        finalMessage.reasoning_content,
        finalMessage.id,
        finalMessage.timings,
      );
    },
    [clearStreamingState],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearStreamingState();
  }, [clearStreamingState]);

  return useMemo(
    () => ({
      streaming,
      isGenerating,
      generate,
      cancel,
      clearStreamingState,
    }),
    [streaming, isGenerating, generate, cancel, clearStreamingState],
  );
}

async function generateWithTools(
  messages: ChatMessage[],
  options: GenerateOptions,
  abortController: AbortController,
  streamingMessage: StreamingMessage,
  setStreaming: (msg: StreamingMessage) => void,
  contentRef: { current: string },
  reasoningRef: { current: string },
): Promise<
  | { success: false; error?: { code: string } }
  | { success: true; data: CompletionOutput }
> {
  try {
    const result = await getAIRuntime().streamCompletionWithTools(messages, {
      enableThinking: options.enableThinking,
      abortSignal: abortController.signal,
      tools: options.tools,
      maxIterations: 3,
      onToolCall: async (name: string, params: Record<string, unknown>) => {
        if (abortController.signal.aborted) {
          return null;
        }
        return (await options.onToolCall?.(name, params)) ?? null;
      },
      onStreamChunk: (chunk) => {
        if (abortController.signal.aborted) return;

        if (chunk.token) contentRef.current += chunk.token;
        if (chunk.reasoning) reasoningRef.current += chunk.reasoning;

        setStreaming({
          ...streamingMessage,
          content: contentRef.current,
          reasoning_content: reasoningRef.current || undefined,
        });

        options.onUpdate?.(contentRef.current, reasoningRef.current);
      },
      onToolExecutionStart: () => {
        setStreaming({
          ...streamingMessage,
          content: contentRef.current + "\n\n[⚙️ Executando ferramenta...]",
          reasoning_content: reasoningRef.current,
        });
      },
      toolOverrides: {
        web_search: { timeoutMs: 60000, maxRetries: 2 },
        fetch_url: { timeoutMs: 30000, maxRetries: 1 },
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: { code: result.error.code },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("[generateWithTools] unexpected error:", error);
    return {
      success: false,
      error: {
        code: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}
