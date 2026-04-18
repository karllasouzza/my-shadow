import { ChatMessage } from "@/database/chat/types";
import { aiDebug, aiError, aiInfo } from "@/shared/ai/log";
import { getAIRuntime } from "@/shared/ai/text-generation/runtime";
import { generateUUID } from "@/shared/random-id";
import type { NativeCompletionResultTimings } from "llama.rn";
import { useCallback, useMemo, useRef, useState } from "react";

export interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
}

interface GenerateOptions {
  modelId: string;
  enableThinking: boolean;
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

      const result = await getAIRuntime().streamCompletion(messages, {
        enableThinking: options.enableThinking,
        abortSignal: abortController.signal,
        onStreamChunk: (chunk) => {
          if (abortController.signal.aborted) return;

          if (chunk.token) contentRef.current += chunk.token;
          if (chunk.reasoning) reasoningRef.current += chunk.reasoning;

          const updatedMessage: StreamingMessage = {
            ...initialMessage,
            content: contentRef.current,
            reasoning_content: reasoningRef.current,
          };

          setStreaming(updatedMessage);
          options.onUpdate?.(contentRef.current, reasoningRef.current);

          aiDebug("INFERENCE:ui:chunk", `messageId=${initialMessage.id}`, {
            tokenPreview: (chunk.token || "").slice(0, 12),
          });
        },
      });

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
