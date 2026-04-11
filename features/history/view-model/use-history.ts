/**
 * useHistory
 *
 * Hook simples com useState — zero Legend State.
 * Exclusivo da HistoryScreen.
 */

import type { ChatConversation, ChatConversationIndex } from "@/features/chat/model/chat-conversation";
import * as DatabaseChat from "@/database/chat";
import { useCallback, useMemo, useState } from "react";
import type { Result } from "@/shared/utils/app-error";

export function useHistory() {
  const [conversations, setConversations] = useState<ChatConversationIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConversations = useCallback(async (): Promise<Result<ChatConversationIndex[]>> => {
    setIsLoading(true);
    setErrorMessage(null);

    const result = DatabaseChat.listConversations();
    if (result.success) {
      setConversations(result.data);
    } else {
      setErrorMessage(result.error.message);
    }

    setIsLoading(false);
    return result;
  }, []);

  const loadFullConversation = useCallback(
    async (id: string): Promise<Result<ChatConversation | null>> => {
      return DatabaseChat.loadConversation(id);
    },
    [],
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<Result<void>> => {
      const result = DatabaseChat.deleteConversation(id);
      if (result.success) {
        await loadConversations();
      }
      return result;
    },
    [loadConversations],
  );

  const renameConversation = useCallback(
    async (id: string, newTitle: string): Promise<Result<ChatConversation | null>> => {
      const result = DatabaseChat.renameConversation(id, newTitle);
      if (result.success) {
        await loadConversations();
      }
      return result;
    },
    [loadConversations],
  );

  return useMemo(
    () => ({
      conversations,
      isLoading,
      errorMessage,
      loadConversations,
      loadFullConversation,
      deleteConversation,
      renameConversation,
    }),
    [
      conversations,
      isLoading,
      errorMessage,
      loadConversations,
      loadFullConversation,
      deleteConversation,
      renameConversation,
    ],
  );
}
