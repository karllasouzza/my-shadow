import chatState$ from "@/database/chat";
import { ChatMessage } from "@/database/chat/types";
import { getAIRuntime } from "@/shared/ai/text-generation/runtime";
import crypto from "expo-crypto";
import { useCallback, useMemo, useRef, useState } from "react";

export interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
}

interface GenerateOptions {
  modelId: string;
  enableThinking: boolean;
  onUpdate?: (content: string, reasoning: string) => void;
  onComplete?: (content: string, reasoning?: string) => void;
  onError?: (
    code: string,
    partialContent?: string,
    partialReasoning?: string,
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
    async (
      conversationId: string,
      messages: ChatMessage[],
      options: GenerateOptions,
    ) => {
      const abortController = new AbortController();
      abortRef.current = abortController;
      contentRef.current = "";
      reasoningRef.current = "";

      // Create initial streaming message
      const initialMessage: StreamingMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        reasoning_content: "",
        modelId: options.modelId,
        createdAt: new Date().toISOString(),
        _isStreaming: true,
      };

      setStreaming(initialMessage);
      setIsGenerating(true);

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
            updatedAt: new Date().toISOString(),
          };

          setStreaming(updatedMessage);
          options.onUpdate?.(contentRef.current, reasoningRef.current);
        },
      });

      abortRef.current = null;

      if (abortController.signal.aborted) {
        clearStreamingState();
        options.onError?.("ABORTED", contentRef.current, reasoningRef.current);
        return;
      }

      if (!result.success) {
        clearStreamingState();
        options.onError?.(
          result.error?.code ?? "GENERATION_FAILED",
          contentRef.current,
          reasoningRef.current,
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
        modelId: options.modelId,
        createdAt: initialMessage.createdAt,
        updatedAt: new Date().toISOString(),
      };

      // Update legend state
      chatState$.conversations.set((prev) => {
        const conv = prev.get(conversationId);
        if (conv) {
          conv.messages.push(finalMessage);
          conv.updatedAt = new Date().toISOString();
        }
        return prev;
      });

      clearStreamingState();
      options.onComplete?.(
        finalMessage.content,
        finalMessage.reasoning_content,
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
