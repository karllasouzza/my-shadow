import * as Database from "@/database/chat";
import { autoGenerateTitle } from "@/features/chat/model/chat-conversation";
import type { ChatMessage } from "@/shared/ai/types/chat";
import { useCallback, useMemo, useState } from "react";

export function useConversation() {
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("Nova conversa");
  const [error, setError] = useState<string | null>(null);

  const init = useCallback((conversationId: string | null) => {
    setError(null);

    if (!conversationId) {
      setId(null);
      setTitle("Nova conversa");
      return;
    }

    const result = Database.loadConversation(conversationId);
    if (!result.success || !result.data) {
      setId(null);
      setTitle("Nova conversa");
      setError("Conversa não encontrada");
      return;
    }

    setId(conversationId);
    setTitle(result.data.title || "Nova conversa");
  }, []);

  const create = useCallback((modelId: string) => {
    const conv = Database.createConversation(modelId);
    Database.saveConversation(conv);
    setId(conv.id);
    setTitle(conv.title);
    return conv.id;
  }, []);

  const addMessage = useCallback((convId: string, message: ChatMessage) => {
    const result = Database.loadConversation(convId);
    if (!result.success || !result.data) return false;

    const conv = result.data;
    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();

    if (
      message.role === "user" &&
      conv.messages.filter((m) => m.role === "user").length === 1
    ) {
      conv.title = autoGenerateTitle(message.content);
      setTitle(conv.title);
    }

    Database.saveConversation(conv);
    return true;
  }, []);

  const updateLastUserError = useCallback(
    (convId: string, errorCode?: string) => {
      const result = Database.loadConversation(convId);
      if (!result.success || !result.data) return;

      const lastUserIdx = result.data.messages.findLastIndex(
        (message) => message.role === "user",
      );

      if (lastUserIdx >= 0) {
        result.data.messages[lastUserIdx].errorCode = errorCode;
        result.data.updatedAt = new Date().toISOString();
        Database.saveConversation(result.data);
      }
    },
    [],
  );

  const removeLastAssistant = useCallback((convId: string) => {
    const result = Database.loadConversation(convId);
    if (!result.success || !result.data) return false;

    const lastUserIdx = result.data.messages.findLastIndex(
      (message) => message.role === "user",
    );

    const lastAssistantIdx = result.data.messages.findLastIndex(
      (message, index) => message.role === "assistant" && index > lastUserIdx,
    );

    if (lastAssistantIdx > lastUserIdx) {
      result.data.messages.splice(lastAssistantIdx, 1);
      result.data.updatedAt = new Date().toISOString();
      Database.saveConversation(result.data);
      return true;
    }

    return false;
  }, []);

  const getMessages = useCallback((convId: string): ChatMessage[] => {
    const result = Database.loadConversation(convId);
    return result.success && result.data ? result.data.messages : [];
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
