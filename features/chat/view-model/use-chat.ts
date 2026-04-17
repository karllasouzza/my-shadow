import * as DatabaseChat from "@/database/chat";
import {
    getThinkingEnabled,
    setThinkingEnabled,
} from "@/database/chat/actions/think-mode";
import {
    createChatMessage,
    validateChatMessage,
} from "@/features/chat/model/chat-message";
import { getAIRuntime } from "@/shared/ai/runtime";
import type { ChatMessage } from "@/shared/ai/types/chat";
import { useCallback, useMemo, useState } from "react";
import { useConversation } from "./hooks/useConversation";
import { useModelManager } from "./hooks/useModelManager";
import { useStreamingGeneration } from "./hooks/useStreamingGeneration";

function toRuntimeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const runtimeMessage: ChatMessage = {
      role:
        message.role === "tool"
          ? "assistant"
          : (message.role as "system" | "user" | "assistant"),
      content: message.content,
    };

    if (message.reasoning_content) {
      runtimeMessage.reasoning_content = message.reasoning_content;
    }

    return runtimeMessage;
  });
}

export function useChat() {
  const conversation = useConversation();
  const model = useModelManager();
  const stream = useStreamingGeneration();

  const [thinkingEnabled, setThinkingEnabledState] = useState(() =>
    getThinkingEnabled(),
  );

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
      DatabaseChat.clearStreamingMessage(conversationId);

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
      setThinkingEnabledState(getThinkingEnabled());
      conversation.init(id);

      if (id) {
        const persisted = DatabaseChat.loadStreamingMessage(id);
        if (persisted.success && persisted.data) {
          stream.restorePersisted(persisted.data);
        }
      }

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

      const messages = toRuntimeMessages(
        conversation.getMessages(conversationId),
      );

      await stream.generate(conversationId, messages, {
        modelId: currentModelId,
        enableThinking: thinkingEnabled,
        onComplete: (text, reasoning, timings) => {
          DatabaseChat.clearStreamingMessage(conversationId);
          const assistantMessage = createChatMessage(
            "assistant",
            text,
            reasoning,
            currentModelId,
          );

          if (timings) {
            (assistantMessage as any).timings = timings;
          }

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
      thinkingEnabled,
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

    await stream.generate(conversationId, toRuntimeMessages(messages), {
      modelId: currentModelId,
      enableThinking: thinkingEnabled,
      onComplete: (text, reasoning, timings) => {
        DatabaseChat.clearStreamingMessage(conversationId);

        const assistantMessage = createChatMessage(
          "assistant",
          text,
          reasoning,
          currentModelId,
        );

        if (timings) {
          (assistantMessage as any).timings = timings;
        }

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
    thinkingEnabled,
  ]);

  const cancelGeneration = useCallback(() => {
    stream.cancel();
    if (conversation.id) {
      stream.flushPersist(conversation.id);
    } else {
      stream.flushPersist();
    }
  }, [conversation.id, stream]);

  const toggleThinking = useCallback(() => {
    setThinkingEnabledState((prev) => {
      const next = !prev;
      setThinkingEnabled(next);
      return next;
    });
  }, []);

  const resetChatState = useCallback(() => {
    stream.cancel();
    if (conversation.id) {
      stream.flushPersist(conversation.id);
    } else {
      stream.flushPersist();
    }
    stream.clearStreamingState();
    conversation.init(null);
  }, [conversation, stream]);

  const displayMessages = useMemo(() => {
    const messages = conversation.id
      ? conversation.getMessages(conversation.id)
      : [];
    return stream.streaming ? [...messages, stream.streaming] : messages;
  }, [conversation, stream.streaming]);

  const hasContent = useMemo(
    () => displayMessages.length > 0,
    [displayMessages.length],
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
      showCancelOption: stream.showCancel && stream.isGenerating,
      thinkingEnabled,
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
      toggleThinking,
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
      stream.showCancel,
      thinkingEnabled,
      displayMessages,
      hasContent,
      activeModelName,
      selectedModelId,
      initChat,
      sendMessage,
      cancelGeneration,
      toggleThinking,
      resetChatState,
      retryLastUserMessage,
      conversation.clearError,
    ],
  );
}
