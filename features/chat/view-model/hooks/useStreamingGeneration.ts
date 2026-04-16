import * as Database from "@/database/chat";
import { getAIRuntime } from "@/shared/ai/runtime";
import type { ChatMessage } from "@/shared/ai/types/chat";
import type { CompletionOutput } from "@/shared/ai/types/runtime";
import { useCallback, useMemo, useRef, useState } from "react";

export interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
  _key: string;
}

interface GenerateOptions {
  modelId: string;
  enableThinking: boolean;
  onUpdate?: (content: string, reasoning: string) => void;
  onComplete?: (
    content: string,
    reasoning?: string,
    timings?: CompletionOutput["timings"],
  ) => void;
  onError?: (
    code: string,
    partialContent?: string,
    partialReasoning?: string,
  ) => void;
}

const STREAMING_PERSIST_THROTTLE_MS = 300;

export function useStreamingGeneration() {
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef<StreamingMessage | null>(null);
  const contentRef = useRef("");
  const reasoningRef = useRef("");

  const keyCounterRef = useRef(0);
  const makeKey = useCallback(
    () => `msg-${Date.now()}-${++keyCounterRef.current}`,
    [],
  );

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (conversationId: string, message: StreamingMessage) => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }

      persistTimerRef.current = setTimeout(() => {
        Database.upsertStreamingMessage(conversationId, {
          ...message,
          reasoning_content: message.reasoning_content || undefined,
        });
        persistTimerRef.current = null;
      }, STREAMING_PERSIST_THROTTLE_MS);
    },
    [],
  );

  const flushPersist = useCallback((conversationId?: string) => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    if (conversationId) {
      Database.clearStreamingMessage(conversationId);
    }
  }, []);

  const clearStreamingState = useCallback(() => {
    streamingRef.current = null;
    setStreaming(null);
    setIsGenerating(false);
    setShowCancel(false);
  }, []);

  const restorePersisted = useCallback(
    (message: ChatMessage) => {
      const restored: StreamingMessage = {
        ...message,
        reasoning_content: message.reasoning_content ?? "",
        _isStreaming: true,
        _key: makeKey(),
      };

      contentRef.current = restored.content;
      reasoningRef.current = restored.reasoning_content ?? "";
      streamingRef.current = restored;
      setStreaming(restored);
      setIsGenerating(false);
      setShowCancel(false);
    },
    [makeKey],
  );

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

      const stableKey = makeKey();
      const initialMessage: StreamingMessage = {
        role: "assistant",
        content: "",
        reasoning_content: "",
        modelId: options.modelId,
        timestamp: new Date().toISOString(),
        _isStreaming: true,
        _key: stableKey,
      };

      streamingRef.current = initialMessage;
      setStreaming(initialMessage);
      setIsGenerating(true);
      setShowCancel(false);

      Database.upsertStreamingMessage(conversationId, initialMessage);

      let fullResponse = "";
      let fullReasoning = "";
      const result = await getAIRuntime().streamCompletion(messages, {
        enableThinking: options.enableThinking,
        abortSignal: abortController.signal,
        onStreamChunk: (chunk) => {
          if (abortController.signal.aborted) return;

          if (chunk.token) {
            contentRef.current += chunk.token;
          }

          if (chunk.reasoning) {
            reasoningRef.current += chunk.reasoning;
          }

          fullResponse = contentRef.current;
          fullReasoning = reasoningRef.current;

          const updatedMessage: StreamingMessage = {
            role: "assistant",
            content: fullResponse,
            reasoning_content: fullReasoning,
            modelId: options.modelId,
            timestamp: new Date().toISOString(),
            _isStreaming: true,
            _key: stableKey,
          };

          streamingRef.current = updatedMessage;
          setStreaming(updatedMessage);
          setShowCancel(true);

          persist(conversationId, updatedMessage);
          options.onUpdate?.(fullResponse, fullReasoning);
        },
      });

      abortRef.current = null;
      setShowCancel(false);
      flushPersist();

      if (abortController.signal.aborted) {
        const partialContent = contentRef.current;
        const partialReasoning = reasoningRef.current;
        clearStreamingState();
        options.onError?.("ABORTED", partialContent, partialReasoning);
        return;
      }

      if (!result.success) {
        const partialContent = contentRef.current;
        const partialReasoning = reasoningRef.current;
        clearStreamingState();
        options.onError?.(
          result.error?.code ?? "GENERATION_FAILED",
          partialContent,
          partialReasoning,
        );
        return;
      }

      const text = result.data.text ?? contentRef.current ?? fullResponse;
      const reasoning =
        result.data.reasoning ?? reasoningRef.current ?? fullReasoning;

      clearStreamingState();
      options.onComplete?.(text, reasoning || undefined, result.data.timings);
    },
    [clearStreamingState, flushPersist, makeKey, persist],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(null);
    setIsGenerating(false);
    setShowCancel(false);
  }, []);

  return useMemo(
    () => ({
      streaming,
      isGenerating,
      showCancel,
      generate,
      cancel,
      flushPersist,
      restorePersisted,
      clearStreamingState,
    }),
    [
      streaming,
      isGenerating,
      showCancel,
      generate,
      cancel,
      flushPersist,
      restorePersisted,
      clearStreamingState,
    ],
  );
}
