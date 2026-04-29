import chatState$ from "@/database/chat";
import { aiError, aiInfo } from "@/shared/ai/log";
import { getAIRuntime } from "@/shared/ai/text-generation/runtime";
import { ToolRegistry, webSearchToolDefinition } from "@/shared/ai/tools";
import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner-native";
import { createChatMessage } from "../model/chat-message";
import { useConversation } from "./hooks/useConversation";
import { useModelManager } from "./hooks/useModelManager";
import { useStreamingGeneration } from "./hooks/useStreamingGeneration";

/** Global tool registry with web search tool pre-registered. */
export const toolRegistry = new ToolRegistry();
toolRegistry.register(webSearchToolDefinition);

/** Simple message validation */
function validateChatMessage(content: string) {
  return { isValid: content.trim().length > 0 };
}

export function useChat() {
  const conversation = useConversation();
  const model = useModelManager();
  const stream = useStreamingGeneration();
  const reasoningEnabled = useValue(chatState$.isReasoningEnabled) ?? false;

  // Consent dialog state
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<{
    query: string;
    resolve: (granted: boolean) => void;
  } | null>(null);

  const resolveCurrentModelId = useCallback(() => {
    return (
      model.selectedId ?? getAIRuntime().getCurrentModel()?.id ?? "unknown"
    );
  }, [model.selectedId]);

  const handleGenerationError = useCallback(
    (
      conversationId: string,
      modelId: string,
      errorCode: string,
      partialContent?: string,
      partialReasoning?: string,
      messageId?: string,
    ) => {
      const hasPartial = !!partialContent?.trim() || !!partialReasoning?.trim();

      if (errorCode === "ABORTED") {
        if (hasPartial) {
          const partialMessage = createChatMessage(
            "assistant",
            `${partialContent ?? ""} [cancelado]`,
            partialReasoning,
            modelId,
          );
          if (messageId) {
            (partialMessage as any).id = messageId;
            (partialMessage as any)._isStreaming = true;
          }
          conversation.addMessage(conversationId, partialMessage);
        }
        stream.clearStreamingState();
        return;
      }

      if (!hasPartial) {
        conversation.updateLastUserError(conversationId, errorCode);
        stream.clearStreamingState();
        return;
      }

      const errorMessage = createChatMessage(
        "assistant",
        `${partialContent ?? ""} [erro na geração]`,
        partialReasoning,
        modelId,
      );
      if (messageId) {
        (errorMessage as any).id = messageId;
        (errorMessage as any)._isStreaming = true;
      }
      conversation.addMessage(conversationId, errorMessage);
      stream.clearStreamingState();
    },
    [conversation],
  );

  const initChat = useCallback(
    async (id: string | null) => {
      stream.clearStreamingState();
      conversation.init(id);
      await model.sync();
    },
    [conversation, model, stream],
  );

  // Get consent for a web search tool call
  const requestConsent = useCallback((query: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConsent({ query, resolve });
      setConsentOpen(true);
    });
  }, []);

  const handleConsentAllow = useCallback(() => {
    pendingConsent?.resolve(true);
    setPendingConsent(null);
    setConsentOpen(false);
  }, [pendingConsent]);

  const handleConsentDecline = useCallback(() => {
    pendingConsent?.resolve(false);
    setPendingConsent(null);
    setConsentOpen(false);
  }, [pendingConsent]);

  const handleToolCall = useCallback(
    async (name: string, params: Record<string, unknown>) => {
      if (name === "web_search") {
        const query = (params.query as string) ?? "";
        const granted = await requestConsent(query);

        if (!granted) {
          aiInfo("TOOL:consent:declined", `query="${query}"`);
          return null;
        }

        aiInfo("TOOL:consent:granted", `query="${query}"`);
        return toolRegistry.execute(name, params);
      }

      return toolRegistry.execute(name, params);
    },
    [requestConsent],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const validation = validateChatMessage(content);
      if (!validation.isValid || !model.isReady) return;

      const currentModelId = resolveCurrentModelId();

      let conversationId = conversation.id;
      if (!conversationId) {
        conversationId = conversation.create(currentModelId);
      }

      const added = conversation.addMessage(
        conversationId,
        createChatMessage("user", content),
      );
      if (!added) return;

      conversation.updateLastUserError(conversationId, undefined);

      const messages = conversation.getMessages(conversationId);

      aiInfo(
        "INFERENCE:start",
        `conversationId=${conversationId} modelId=${currentModelId}`,
        { conversationId, modelId: currentModelId },
      );
      await stream.generate(messages, {
        modelId: currentModelId,
        enableThinking: reasoningEnabled,
        tools: toolRegistry.getAll(),
        onToolCall: handleToolCall,
        onComplete: (text, reasoning, messageId, timings) => {
          aiInfo(
            "INFERENCE:start",
            `conversationId=${conversationId} modelId=${currentModelId}`,
          );
          const assistantMessage = createChatMessage(
            "assistant",
            text,
            reasoning,
            currentModelId,
          );
          if (messageId) {
            (assistantMessage as any).id = messageId;
          }
          if (timings) {
            (assistantMessage as any).timings = timings;
          }
          aiInfo(
            "INFERENCE:end",
            `conversationId=${conversationId} modelId=${currentModelId}`,
            { conversationId, modelId: currentModelId, timings },
          );
          conversation.addMessage(conversationId, assistantMessage);
          stream.clearStreamingState();
        },
        onError: (code, partialText, partialReasoning, messageId) => {
          aiError(
            "INFERENCE:error",
            `conversationId=${conversationId} modelId=${currentModelId} code=${code}`,
          );
          handleGenerationError(
            conversationId,
            currentModelId,
            code,
            partialText,
            partialReasoning,
            messageId,
          );
        },
      });
    },
    [
      conversation,
      handleGenerationError,
      model.isReady,
      resolveCurrentModelId,
      stream,
      reasoningEnabled,
      handleToolCall,
    ],
  );

  const retryLastUserMessage = useCallback(async () => {
    if (!conversation.id) return;

    const conversationId = conversation.id;
    conversation.removeLastAssistant(conversationId);

    const messages = conversation.getMessages(conversationId);
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === "user",
    );
    if (lastUserIndex < 0) return;

    conversation.updateLastUserError(conversationId, undefined);

    const currentModelId = resolveCurrentModelId();

    aiInfo(
      "INFERENCE:start",
      `conversationId=${conversationId} modelId=${currentModelId}`,
      { conversationId, modelId: currentModelId },
    );
    await stream.generate(messages, {
      modelId: currentModelId,
      enableThinking: reasoningEnabled,
      tools: toolRegistry.getAll(),
      onToolCall: handleToolCall,
      onComplete: (text, reasoning, messageId, timings) => {
        const assistantMessage = createChatMessage(
          "assistant",
          text,
          reasoning,
          currentModelId,
        );
        if (messageId) {
          assistantMessage.id = messageId;
        }
        if (timings) {
          assistantMessage.timings = timings;
        }
        conversation.addMessage(conversationId, assistantMessage);
        stream.clearStreamingState();
      },
      onError: (code, partialText, partialReasoning, messageId) => {
        handleGenerationError(
          conversationId,
          currentModelId,
          code,
          partialText,
          partialReasoning,
          messageId,
        );
      },
    });
  }, [
    conversation,
    handleGenerationError,
    resolveCurrentModelId,
    stream,
    reasoningEnabled,
    handleToolCall,
  ]);

  const cancelGeneration = useCallback(() => {
    stream.cancel();
  }, [stream]);

  const toggleReasoning = useCallback(() => {
    chatState$.isReasoningEnabled.set((prev) => !prev);
  }, []);

  const resetChatState = useCallback(() => {
    stream.cancel();
    stream.clearStreamingState();
    conversation.init(null);
  }, [conversation, stream]);

  const handleLoadModelForConversation = useCallback(
    async (conversationId: string | null) => {
      try {
        if (!conversationId) {
          await model.autoLoad();
          return;
        }

        const lastModelId = conversation.getLastModelUsedId(conversationId);
        if (lastModelId) {
          await model.load(lastModelId);
        } else {
          await model.autoLoad();
        }
      } catch (error) {
        console.error(
          "[useChat] Failed to load model for conversation:",
          error instanceof Error ? error.message : String(error),
        );
        toast.error("Ocorreu um erro ao carregar o modelo.");
      }
    },
    [conversation, model],
  );

  const displayMessages = useMemo(() => {
    const messages = conversation.id
      ? conversation.getMessages(conversation.id)
      : [];
    return stream.streaming ? [...messages, stream.streaming] : messages;
  }, [conversation.id, stream.streaming]);

  const hasContent = useMemo(
    () => displayMessages.length > 0,
    [displayMessages],
  );

  const selectedModelId = model.selectedId;
  const activeModelName = selectedModelId;

  return useMemo(
    () => ({
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      isModelReady: model.isReady,
      isGenerating: stream.isGenerating,
      streamingMessage: stream.streaming,
      modelError: model.error,
      conversationError: conversation.error,
      reasoningEnabled,
      displayMessages,
      hasContent,
      activeModelName,
      selectedModelId,
      selectedWhisperModelId: model.selectedWhisperId,
      availableModels: model.available,
      isModelLoading: model.isLoading,

      // Consent dialog state
      consentOpen,
      pendingConsent,
      handleConsentAllow,
      handleConsentDecline,

      initChat,
      syncModelStatus: model.sync,
      sendMessage,
      cancelGeneration,
      toggleReasoning,
      resetChatState,
      retryLastUserMessage,
      clearConversationError: conversation.clearError,

      handleLoadModel: model.load,
      handleLoadWhisperModel: model.loadWhisper,
      handleUnloadModel: model.unload,
      handleAutoLoadLastModel: model.autoLoad,
      handleAutoLoadWhisper: model.autoLoadWhisper,
      handleLoadModelForConversation,
      refreshModelsOnFocus: model.refresh,
    }),
    [
      conversation.id,
      conversation.title,
      conversation.error,
      model.isReady,
      model.error,
      model.available,
      model.isLoading,
      model.sync,
      model.load,
      model.loadWhisper,
      model.autoLoadWhisper,
      model.unload,
      model.autoLoad,
      model.refresh,
      stream.isGenerating,
      stream.streaming,
      reasoningEnabled,
      displayMessages,
      hasContent,
      activeModelName,
      selectedModelId,
      model.selectedWhisperId,
      consentOpen,
      pendingConsent,
      handleConsentAllow,
      handleConsentDecline,
      initChat,
      sendMessage,
      cancelGeneration,
      toggleReasoning,
      resetChatState,
      retryLastUserMessage,
      conversation.clearError,
      handleLoadModelForConversation,
    ],
  );
}
