import chatState$ from "@/database/chat";
import { ChatConversation, ChatMessage } from "@/database/chat/types";
import {
    autoGenerateTitle,
    createChatConversation,
} from "@/features/chat/model/chat-conversation";

import { useCallback, useMemo, useState } from "react";

export function useConversation() {
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Nova conversa");
  const [error, setError] = useState<string | null>(null);

  const init = useCallback((conversationId: string | null) => {
    setError(null);

    const convFallback = createChatConversation("Nova conversa");

    if (conversationId) {
      const existing = chatState$.conversations.get()?.[conversationId];
      if (existing) {
        setId(existing.id);
        setTitle(existing.title);
        return;
      }
    }

    setId(null);
    setTitle(convFallback.title);
  }, []);

  const create = useCallback((modelId: string, title?: string) => {
    const newConversation: ChatConversation = createChatConversation(
      title ?? "Nova conversa",
      modelId,
    );

    chatState$.conversations.set((prev) => {
      prev[newConversation.id] = newConversation;
      return { ...prev };
    });
    chatState$.lastModelId.set(modelId);

    setId(newConversation.id);
    setTitle(newConversation.title);
    return newConversation.id;
  }, []);

  const addMessage = useCallback((convId: string, message: ChatMessage) => {
    let success = false;

    if (!chatState$.conversations.get()?.[convId]) {
      const newConvId = create(message.modelId!, "Nova conversa");
      convId = newConvId;
    }

    chatState$.conversations.set((prev) => {
      const conv = prev[convId];
      if (!conv) return prev;

      conv.messages.push(message);
      conv.lastMessage = message.content;
      conv.lastModelUsedId = message.modelId ?? conv.lastModelUsedId;
      conv.updatedAt = new Date().toISOString();

      if (
        message.role === "user" &&
        conv.messages.filter((m) => m.role === "user").length === 1
      ) {
        conv.title = autoGenerateTitle(message.content);
        setTitle(conv.title);
      }

      success = true;
      return { ...prev };
    });

    chatState$.lastModelId.set(message.modelId ?? null);

    return success;
  }, []);

  const updateLastUserError = useCallback(
    (convId: string, errorCode?: string) => {
      chatState$.conversations.set((prev) => {
        const conv = prev[convId];
        if (!conv) return prev;

        const lastUserIdx = conv.messages.findLastIndex(
          (message) => message.role === "user",
        );

        if (lastUserIdx >= 0) {
          conv.messages[lastUserIdx].errorCode = errorCode;
          conv.updatedAt = new Date().toISOString();
        }

        return { ...prev };
      });
    },
    [],
  );

  const removeLastAssistant = useCallback((convId: string) => {
    let success = false;

    chatState$.conversations.set((prev) => {
      const conv = prev[convId];
      if (!conv) return prev;

      const lastUserIdx = conv.messages.findLastIndex(
        (message) => message.role === "user",
      );

      const lastAssistantIdx = conv.messages.findLastIndex(
        (message, index) => message.role === "assistant" && index > lastUserIdx,
      );

      if (lastAssistantIdx > lastUserIdx) {
        conv.messages.splice(lastAssistantIdx, 1);
        conv.updatedAt = new Date().toISOString();
        conv.lastMessage = conv.messages[conv.messages.length - 1].content;
        conv.lastModelUsedId = conv.messages[conv.messages.length - 1].modelId;
        success = true;
      }

      return { ...prev };
    });

    return success;
  }, []);

  const getMessages = useCallback((convId: string): ChatMessage[] => {
    const conv = chatState$.conversations.get()?.[convId];
    return conv ? conv.messages : [];
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getLastModelUsedId = useCallback((convId: string): string | null => {
    const conv = chatState$.conversations.get()?.[convId];
    return conv ? (conv.lastModelUsedId ?? null) : null;
  }, []);

  return useMemo(
    () => ({
      id,
      title,
      error,
      init,
      create,
      addMessage,
      updateLastUserError,
      removeLastAssistant,
      getMessages,
      clearError,
      getLastModelUsedId,
    }),
    [
      id,
      title,
      error,
      init,
      create,
      addMessage,
      updateLastUserError,
      removeLastAssistant,
      getMessages,
      clearError,
      getLastModelUsedId,
    ],
  );
}
