import * as DatabaseChat from "@/database/chat";
import type {
    ChatConversation,
    ChatConversationIndex,
} from "@/features/chat/model/chat-conversation";
import type { Result } from "@/shared/utils/app-error";
import { useCallback, useMemo, useState } from "react";

export function useHistory() {
  const [conversations, setConversations] = useState<ChatConversationIndex[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConversations = useCallback(async (): Promise<
    Result<ChatConversationIndex[]>
  > => {
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
    async (
      id: string,
      newTitle: string,
    ): Promise<Result<ChatConversation | null>> => {
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
      deleteConversation,
      renameConversation,
    }),
    [
      conversations,
      isLoading,
      errorMessage,
      loadConversations,
      deleteConversation,
      renameConversation,
    ],
  );
}
