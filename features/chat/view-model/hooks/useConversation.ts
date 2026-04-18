import chatState$ from "@/database/chat";
import { ChatConversation, ChatMessage } from "@/database/chat/types";
import {
  autoGenerateTitle,
  createChatConversation,
} from "@/features/chat/model/chat-conversation";
import crypto from "expo-crypto";
import { useCallback, useMemo, useState } from "react";

export function useConversation() {
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("Nova conversa");
  const [error, setError] = useState<string | null>(null);

  const init = useCallback((conversationId: string | null) => {
    setError(null);

    const convId = conversationId || crypto.randomUUID();
    setId(convId);

    chatState$.conversations.set((prev) => {
      if (!prev.has(convId)) {
        const newConv = createChatConversation(
          "Nova conversa",
          "defaultModelId",
        );
        prev.set(convId, newConv);
        setTitle(newConv.title);
      } else {
        const conv = prev.get(convId);
        if (conv) setTitle(conv.title);
      }
      return prev;
    });
  }, []);

  const create = useCallback((modelId: string) => {
    const newConversation: ChatConversation = createChatConversation(
      "Nova conversa",
      modelId,
    );

    chatState$.conversations.set((prev) => {
      prev.set(newConversation.id, newConversation);
      return prev;
    });
    chatState$.lastModelId.set(modelId);

    setId(newConversation.id);
    setTitle(newConversation.title);
    return newConversation.id;
  }, []);

  const addMessage = useCallback((convId: string, message: ChatMessage) => {
    let success = false;

    chatState$.conversations.set((prev) => {
      const conv = prev.get(convId);
      if (!conv) return prev;

      conv.messages.push(message);
      conv.updatedAt = new Date().toISOString();

      if (
        message.role === "user" &&
        conv.messages.filter((m) => m.role === "user").length === 1
      ) {
        conv.title = autoGenerateTitle(message.content);
        setTitle(conv.title);
      }

      success = true;
      return prev;
    });

    return success;
  }, []);

  const updateLastUserError = useCallback(
    (convId: string, errorCode?: string) => {
      chatState$.conversations.set((prev) => {
        const conv = prev.get(convId);
        if (!conv) return prev;

        const lastUserIdx = conv.messages.findLastIndex(
          (message) => message.role === "user",
        );

        if (lastUserIdx >= 0) {
          conv.messages[lastUserIdx].errorCode = errorCode;
          conv.updatedAt = new Date().toISOString();
        }

        return prev;
      });
    },
    [],
  );

  const removeLastAssistant = useCallback((convId: string) => {
    let success = false;

    chatState$.conversations.set((prev) => {
      const conv = prev.get(convId);
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
        success = true;
      }

      return prev;
    });

    return success;
  }, []);

  const getMessages = useCallback((convId: string): ChatMessage[] => {
    const conversations = chatState$.conversations.get();
    const conv = conversations.get(convId);
    return conv ? conv.messages : [];
  }, []);

  const clearError = useCallback(() => {
    setError(null);
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
    ],
  );
}
