import type { ChatConversationIndex } from "@/features/chat/model/chat-conversation";
import { ConversationList } from "@/features/history/components/conversation-list";
import { EmptyHistory } from "@/features/history/components/empty-history";
import { useHistory } from "@/features/history/view-model/use-history";
import { observer } from "@legendapp/state/react";
import { router, useFocusEffect } from "expo-router";
import React, { memo, useCallback } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

const HistoryScreenInner = observer(function HistoryScreenInner() {
  const {
    conversations,
    isLoading,
    errorMessage,
    loadConversations,
    loadFullConversation,
    deleteConversation,
    renameConversation,
  } = useHistory();

  const handleConversationPress = useCallback(
    async (id: string) => {
      await loadFullConversation(id);
      router.push({
        pathname: "/chat",
        params: { conversationId: id },
      });
    },
    [loadFullConversation],
  );

  const handleRename = useCallback(
    async (conv: ChatConversationIndex) => {
      Alert.prompt(
        "Renomear Conversa",
        "Novo título:",
        async (newTitle) => {
          if (newTitle && newTitle.trim()) {
            const result = await renameConversation(conv.id, newTitle.trim());
            if (!result.success) {
              Alert.alert("Erro", result.error.message);
            }
          }
        },
        "plain-text",
        conv.title,
      );
    },
    [renameConversation],
  );

  const handleDelete = useCallback(
    async (conv: ChatConversationIndex) => {
      Alert.alert(
        "Excluir Conversa",
        `Tem certeza que deseja excluir "${conv.title}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: async () => {
              const result = await deleteConversation(conv.id);
              if (!result.success) {
                Alert.alert("Erro", result.error.message);
              }
            },
          },
        ],
      );
    },
    [deleteConversation],
  );

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

  const refreshList = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      refreshList();
    }, [refreshList]),
  );

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
});

export const HistoryScreen = memo(function HistoryScreen() {
  return <HistoryScreenInner />;
});
