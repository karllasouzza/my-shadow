import chatState$ from "@/database/chat";
import { aiError, aiInfo } from "@/shared/ai/log";
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
          // Preserve the streaming message ID for smooth transition
          if (messageId) {
            (assistantMessage as any).id = messageId;
          }
          // Add timings if available
          if (timings) {
            (assistantMessage as any).timings = timings;
          }
          aiInfo(
            "INFERENCE:end",
            `conversationId=${conversationId} modelId=${currentModelId}`,
            { conversationId, modelId: currentModelId, timings },
          );
          conversation.addMessage(conversationId, assistantMessage);
          // Clear streaming state after saving to Legend State for smooth transition
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
      onComplete: (text, reasoning, messageId, timings) => {
        const assistantMessage = createChatMessage(
          "assistant",
          text,
          reasoning,
          currentModelId,
        );
        // Preserve the streaming message ID for smooth transition
        if (messageId) {
          (assistantMessage as any).id = messageId;
        }
        // Add timings if available
        if (timings) {
          (assistantMessage as any).timings = timings;
        }
        conversation.addMessage(conversationId, assistantMessage);
        // Clear streaming state after saving to Legend State for smooth transition
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
          // New conversation - load the last used model globally
          await model.autoLoad();
          return;
        }

        // Existing conversation - try to load the model that was used before
        const lastModelId = conversation.getLastModelUsedId(conversationId);
        if (lastModelId) {
          await model.load(lastModelId);
        } else {
          // Fallback to last used model globally
          await model.autoLoad();
        }
      } catch (error) {
        // Log the error but don't crash - allow chat to continue without voice input
        console.error(
          "[useChat] Failed to load model for conversation:",
          error instanceof Error ? error.message : String(error),
        );
        // Model loading is optional for text-based chat
        // Voice input will show an error message to the user
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
