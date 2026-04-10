/**
 * T056/T058: History screen
 *
 * ConversationList or EmptyHistoryState, loading spinner.
 * Auto-refresh on focus via useFocusEffect.
 * Tap → switch to Chat tab + load conversation.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import { ConversationList } from "@/features/history/components/conversation-list";
import { EmptyHistory } from "@/features/history/components/empty-history";
import {
  loadConversations,
} from "@/features/history/view-model/use-history-vm";
import { loadConversation as loadChatConversation } from "@/features/chat/view-model/use-chat-vm";
import type { ChatConversationIndex } from "@/features/chat/model/chat-conversation";

export function HistoryScreen() {
  const [conversations, setConversations] = useState<ChatConversationIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // T058: Handle conversation tap → switch to Chat tab + load conversation
  const handleConversationPress = useCallback(async (id: string) => {
    // Load conversation into chat VM
    await loadChatConversation(id);
    // Switch to Chat tab
    router.push("/(tabs)/chat");
  }, []);

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
        />
      )}
    </View>
  );
}
