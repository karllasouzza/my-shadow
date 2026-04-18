import chatState$ from "@/database/chat";
import { ChatConversation } from "@/database/chat/types";
import { useValue } from "@legendapp/state/react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner-native";

export function useHistory() {
  const conversationsRecord = useValue(chatState$.conversations) ?? {};

  // Convert Record to sorted array and keep reactive
  const conversations = useMemo(() => {
    const list = Object.values(conversationsRecord);
    return list.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );
  }, [conversationsRecord]);

  const deleteConversation = useCallback((id: string): boolean => {
    try {
      const exists = chatState$.conversations.peek()?.[id];
      if (!exists) {
        toast.error("Conversa não encontrada.");
        return false;
      }

      chatState$.conversations.set((prev) => {
        const newPrev = { ...prev };
        delete newPrev[id];
        return newPrev;
      });

      toast.success("Conversa deletada com sucesso.");
      return true;
    } catch (error) {
      toast.error("Falha ao deletar conversa.");
      return false;
    }
  }, []);

  const renameConversation = useCallback(
    (id: string, newTitle: string): boolean => {
      try {
        if (!newTitle?.trim()) {
          toast.error("O título não pode ser vazio.");
          return false;
        }

        let result: ChatConversation | null = null;

        chatState$.conversations.set((prev) => {
          const conv = prev[id];
          if (conv) {
            // Create a new object reference to ensure Legend State detects the change
            const updated: ChatConversation = {
              ...conv,
              title: newTitle.trim(),
              updatedAt: new Date().toISOString(),
            };
            prev[id] = updated;
            result = updated;
          }
          return { ...prev };
        });

        if (!result) {
          toast.error("Conversa não encontrada.");
          return false;
        }

        toast.success("Conversa renomeada com sucesso.");
        return true;
      } catch (error) {
        toast.error("Falha ao renomear conversa.");
        return false;
      }
    },
    [],
  );

  return useMemo(
    () => ({
      conversations,
      deleteConversation,
      renameConversation,
    }),
    [conversations, deleteConversation, renameConversation],
  );
}
