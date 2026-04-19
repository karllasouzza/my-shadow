import chatState$ from "@/database/chat";
import { ChatConversation, ChatMessage } from "@/database/chat/types";
import {
    autoGenerateTitle,
    createChatConversation,
} from "@/features/chat/model/chat-conversation";
import { aiDebug } from "@/shared/ai/log";

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
      return {
        ...prev,
        [newConversation.id]: newConversation,
      };
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

    const prevConvCount = Object.keys(
      chatState$.conversations.peek() ?? {},
    ).length;

    chatState$.conversations.set((prev) => {
      const conv = prev[convId];
      if (!conv) {
        aiDebug(
          "CONVERSATION:addMessage:skip",
          `Conversation ${convId} not found`,
        );
        return prev;
      }

      const newMessages = [...conv.messages, message];
      const newTitle =
        message.role === "user" &&
        newMessages.filter((m) => m.role === "user").length === 1
          ? autoGenerateTitle(message.content)
          : conv.title;

      if (newTitle !== conv.title) {
        setTitle(newTitle);
      }

      const updatedConversation: ChatConversation = {
        ...conv,
        messages: newMessages,
        lastMessage: message.content,
        lastModelUsedId: message.modelId ?? conv.lastModelUsedId,
        updatedAt: new Date().toISOString(),
        title: newTitle,
      };

      aiDebug(
        "CONVERSATION:addMessage:updating",
        `convId=${convId} msgCount=${newMessages.length} role=${message.role}`,
        { conversationId: convId, messageCount: newMessages.length },
      );

      success = true;
      return {
        ...prev,
        [convId]: updatedConversation,
      };
    });

    chatState$.lastModelId.set(message.modelId ?? null);

    const newConvCount = Object.keys(
      chatState$.conversations.peek() ?? {},
    ).length;
    aiDebug(
      "CONVERSATION:addMessage:done",
      `success=${success} convCount=${prevConvCount}->${newConvCount}`,
      { success, previousCount: prevConvCount, newCount: newConvCount },
    );

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

        if (lastUserIdx < 0) return prev;

        const newMessages = conv.messages.map((msg, idx) =>
          idx === lastUserIdx ? { ...msg, errorCode } : msg,
        );

        const updatedConversation: ChatConversation = {
          ...conv,
          messages: newMessages,
          updatedAt: new Date().toISOString(),
        };

        return {
          ...prev,
          [convId]: updatedConversation,
        };
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

      if (lastAssistantIdx <= lastUserIdx) return prev;

      const newMessages = conv.messages.filter(
        (_, index) => index !== lastAssistantIdx,
      );

      const lastMessage = newMessages[newMessages.length - 1];
      const updatedConversation: ChatConversation = {
        ...conv,
        messages: newMessages,
        updatedAt: new Date().toISOString(),
        lastMessage: lastMessage?.content ?? conv.lastMessage,
        lastModelUsedId: lastMessage?.modelId ?? conv.lastModelUsedId,
      };

      success = true;
      return {
        ...prev,
        [convId]: updatedConversation,
      };
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
