/**
 * T056/T058/T061/T062/T064: History screen with manage (rename/delete)
 *
 * ConversationList or EmptyHistoryState, loading spinner.
 * Auto-refresh on focus via useFocusEffect.
 * Tap → switch to Chat tab + load conversation.
 * Long-press → rename/delete confirmation dialogs.
 */
import type { ChatConversationIndex } from "@/features/chat/model/chat-conversation";
import {
    loadConversation as loadChatConversation,
    resetChatState,
} from "@/features/chat/view-model/use-chat-vm";
import { ConversationList } from "@/features/history/components/conversation-list";
import { EmptyHistory } from "@/features/history/components/empty-history";
import {
    deleteConversation,
    loadConversations,
    renameConversation,
} from "@/features/history/view-model/use-history-vm";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

export function HistoryScreen() {
  const [conversations, setConversations] = useState<ChatConversationIndex[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Track currently loaded conversation in chat for T064 edge case
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // T058: Handle conversation tap → switch to Chat tab + load conversation
  const handleConversationPress = useCallback(async (id: string) => {
    setCurrentChatId(id);
    await loadChatConversation(id);
    router.push("/(tabs)/chat");
  }, []);

  // T061: Rename flow — long-press → Alert.prompt
  const handleRename = useCallback(async (conv: ChatConversationIndex) => {
    Alert.prompt(
      "Renomear Conversa",
      "Novo título:",
      async (newTitle) => {
        if (newTitle && newTitle.trim()) {
          const result = await renameConversation(conv.id, newTitle.trim());
          if (result.success) {
            await refreshList();
          } else {
            Alert.alert("Erro", result.error.message);
          }
        }
      },
      "plain-text",
      conv.title,
    );
  }, []);

  // T062: Delete flow — long-press → Alert.alert confirmation
  const handleDelete = useCallback(
    async (conv: ChatConversationIndex) => {
      Alert.alert(
        "Excluir Conversa",
        `Tem certeza que deseja excluir "${conv.title}"? Esta ação não pode ser desfeita.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: async () => {
              const result = await deleteConversation(conv.id);
              if (!result.success) {
                Alert.alert("Erro", result.error.message);
                return;
              }
              // T064: If deleted conversation is currently open in chat, reset chat
              if (currentChatId === conv.id) {
                resetChatState();
                setCurrentChatId(null);
              }
              await refreshList();
            },
          },
        ],
      );
    },
    [currentChatId],
  );

  // Long-press handler — shows action sheet (rename/delete)
  const handleLongPress = useCallback(
    (conv: ChatConversationIndex) => {
      Alert.alert(conv.title, "O que deseja fazer?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Renomear", onPress: () => handleRename(conv) },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => handleDelete(conv),
        },
      ]);
    },
    [handleRename, handleDelete],
  );

  // Refresh list on focus
  const refreshList = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const result = await loadConversations();
    if (result.success) {
      setConversations(result.data);
    } else {
      setErrorMessage(result.error.message);
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshList();
    }, [refreshList]),
  );

  // Initial load
  useEffect(() => {
    refreshList();
  }, []);

  if (isLoading && conversations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-muted text-sm mt-3">Carregando...</Text>
      </View>
    );
  }

  if (errorMessage && conversations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-destructive text-center">{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {conversations.length === 0 ? (
        <EmptyHistory />
      ) : (
        <ConversationList
          conversations={conversations}
          isLoading={isLoading}
          onRefresh={refreshList}
          onPress={handleConversationPress}
          onLongPress={handleLongPress}
        />
      )}
    </View>
  );
}
