import { ChatMessage } from "@/database/chat/types";
import { aiError, aiInfo } from "@/shared/ai/log";
import type {
  CompletionOutput,
  CompletionTimings,
  GenerateOptions as EngineGenerateOptions,
  Message,
  StreamEvent,
  ToolDefinitionForEngine,
  ToolResultForEngine,
} from "@/shared/ai/text-generation";
import { getTextEngine } from "@/shared/ai/text-generation";
import { generateUUID } from "@/shared/random-id";
import { useCallback, useMemo, useRef, useState } from "react";

export interface StreamingMessage extends ChatMessage {
  _isStreaming: true;
}

interface GenerateOptions {
  modelId: string;
  enableThinking: boolean;
  tools?: ToolDefinitionForEngine[];
  onUpdate?: (content: string, reasoning: string) => void;
  onComplete?: (
    content: string,
    reasoning?: string,
    messageId?: string,
    timings?: CompletionTimings | null,
  ) => void;
  onError?: (
    code: string,
    partialContent?: string,
    partialReasoning?: string,
    messageId?: string,
  ) => void;
  onToolCall?: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<ToolResultForEngine | null>;
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

      const messageId = generateUUID();
      const base = createStreamingBase(messageId);
      setIsGenerating(true);
      setStreaming(base);

      const result = await getTextEngine().generate(
        toEngineMessages(messages),
        buildEngineOptions(
          options,
          abortController,
          base,
          contentRef,
          reasoningRef,
          setStreaming,
        ),
      );

      abortRef.current = null;

      if (abortController.signal.aborted) {
        onAborted(
          messageId,
          contentRef,
          reasoningRef,
          options,
          clearStreamingState,
        );
        return;
      }
      if (!result.ok) {
        onFailed(
          result.error,
          messageId,
          contentRef,
          reasoningRef,
          options,
          clearStreamingState,
        );
        return;
      }
      onCompleted(
        result.data,
        messageId,
        contentRef,
        reasoningRef,
        options,
        clearStreamingState,
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
    () => ({ streaming, isGenerating, generate, cancel, clearStreamingState }),
    [streaming, isGenerating, generate, cancel, clearStreamingState],
  );
}

// ─── Pure helpers ───

function createStreamingBase(messageId: string): StreamingMessage {
  return {
    id: messageId,
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
    _isStreaming: true,
  };
}

function toEngineMessages(messages: readonly ChatMessage[]): Message[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.tool_calls?.length
      ? {
          tool_calls: m.tool_calls.map((tc) => ({
            id: tc.id ?? "",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        }
      : {}),
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
  }));
}

function buildEngineOptions(
  options: GenerateOptions,
  abortController: AbortController,
  base: StreamingMessage,
  contentRef: { current: string },
  reasoningRef: { current: string },
  setStreaming: (msg: StreamingMessage) => void,
): EngineGenerateOptions {
  return {
    enableThinking: options.enableThinking,
    abortSignal: abortController.signal,
    tools: options.tools,
    maxToolIterations: 3,
    onToolCall: options.onToolCall
      ? async (name, params) => {
          if (abortController.signal.aborted) return null;
          return (await options.onToolCall?.(name, params)) ?? null;
        }
      : undefined,
    onEvent: (event) => {
      if (abortController.signal.aborted) return;
      handleStreamEvent(
        event,
        base,
        contentRef,
        reasoningRef,
        setStreaming,
        options.onUpdate,
      );
    },
    onToolExecutionStart: () => {
      setStreaming({
        ...base,
        content: contentRef.current + "\n\n[⚙️ Executando ferramenta...]",
        reasoning_content: reasoningRef.current || undefined,
      });
    },
  };
}

function handleStreamEvent(
  event: StreamEvent,
  base: StreamingMessage,
  contentRef: { current: string },
  reasoningRef: { current: string },
  setStreaming: (msg: StreamingMessage) => void,
  onUpdate?: (content: string, reasoning: string) => void,
): void {
  if (event.type === "text") contentRef.current += event.token;
  else if (event.type === "thinking") reasoningRef.current += event.token;
  else return;

  setStreaming({
    ...base,
    content: contentRef.current,
    reasoning_content: reasoningRef.current || undefined,
  });
  onUpdate?.(contentRef.current, reasoningRef.current);
}

function onAborted(
  messageId: string,
  contentRef: { current: string },
  reasoningRef: { current: string },
  options: GenerateOptions,
  clearStreamingState: () => void,
): void {
  aiInfo("INFERENCE:ui:aborted", `messageId=${messageId}`);
  clearStreamingState();
  options.onError?.(
    "ABORTED",
    contentRef.current,
    reasoningRef.current,
    messageId,
  );
}

function onFailed(
  error: { code: string; message: string },
  messageId: string,
  contentRef: { current: string },
  reasoningRef: { current: string },
  options: GenerateOptions,
  clearStreamingState: () => void,
): void {
  aiError("INFERENCE:ui:error", `messageId=${messageId} code=${error.code}`);
  clearStreamingState();
  options.onError?.(
    error.code,
    contentRef.current,
    reasoningRef.current,
    messageId,
  );
}

function onCompleted(
  data: CompletionOutput,
  messageId: string,
  contentRef: { current: string },
  reasoningRef: { current: string },
  options: GenerateOptions,
  clearStreamingState: () => void,
): void {
  clearStreamingState();
  aiInfo("INFERENCE:ui:complete", `messageId=${messageId}`, {
    messageId,
    timings: data.timings,
  });
  options.onComplete?.(
    data.text || contentRef.current,
    data.reasoning || reasoningRef.current || undefined,
    messageId,
    data.timings,
  );
}
