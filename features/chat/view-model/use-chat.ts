import chatState$ from "@/database/chat";
import { getAIRuntime } from "@/shared/ai/text-generation/runtime";
import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { createChatMessage } from "../model/chat-message";
import { useConversation } from "./hooks/useConversation";
import { useModelManager } from "./hooks/useModelManager";
import { useStreamingGeneration } from "./hooks/useStreamingGeneration";

/** Simple message validation */
function validateChatMessage(content: string) {
  return { isValid: content.trim().length > 0 };
}

export function useChat() {
  const conversation = useConversation();
  const model = useModelManager();
  const stream = useStreamingGeneration();
  const reasoningEnabled = useValue(chatState$.isReasoningEnabled) ?? false;

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
    ) => {
      const hasPartial = !!partialContent?.trim() || !!partialReasoning?.trim();

      if (errorCode === "ABORTED") {
        if (hasPartial) {
          conversation.addMessage(
            conversationId,
            createChatMessage(
              "assistant",
              `${partialContent ?? ""} [cancelado]`,
              partialReasoning,
              modelId,
            ),
          );
        }
        return;
      }

      if (!hasPartial) {
        conversation.updateLastUserError(conversationId, errorCode);
        return;
      }

      conversation.addMessage(
        conversationId,
        createChatMessage(
          "assistant",
          `${partialContent ?? ""} [erro na geração]`,
          partialReasoning,
          modelId,
        ),
      );
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

      await stream.generate(messages, {
        modelId: currentModelId,
        enableThinking: reasoningEnabled,
        onComplete: (text, reasoning) => {
          const assistantMessage = createChatMessage(
            "assistant",
            text,
            reasoning,
            currentModelId,
          );
          conversation.addMessage(conversationId, assistantMessage);
        },
        onError: (code, partialText, partialReasoning) => {
          handleGenerationError(
            conversationId,
            currentModelId,
            code,
            partialText,
            partialReasoning,
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

    await stream.generate(messages, {
      modelId: currentModelId,
      enableThinking: reasoningEnabled,
      onComplete: (text, reasoning) => {
        const assistantMessage = createChatMessage(
          "assistant",
          text,
          reasoning,
          currentModelId,
        );
        conversation.addMessage(conversationId, assistantMessage);
      },
      onError: (code, partialText, partialReasoning) => {
        handleGenerationError(
          conversationId,
          currentModelId,
          code,
          partialText,
          partialReasoning,
        );
      },
    });
  }, [
    conversation,
    handleGenerationError,
    resolveCurrentModelId,
    stream,
    reasoningEnabled,
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

  const displayMessages = useMemo(() => {
    const messages = conversation.id
      ? conversation.getMessages(conversation.id)
      : [];
    return stream.streaming ? [...messages, stream.streaming] : messages;
  }, [conversation.id, conversation, stream.streaming]);

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
      availableModels: model.available,
      isModelLoading: model.isLoading,

      initChat,
      syncModelStatus: model.sync,
      sendMessage,
      cancelGeneration,
      toggleReasoning,
      resetChatState,
      retryLastUserMessage,
      clearConversationError: conversation.clearError,

      handleLoadModel: model.load,
      handleUnloadModel: model.unload,
      handleAutoLoadLastModel: model.autoLoad,
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
      initChat,
      sendMessage,
      cancelGeneration,
      toggleReasoning,
      resetChatState,
      retryLastUserMessage,
      conversation.clearError,
    ],
  );
}
