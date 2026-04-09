/**
 * T047-T055: History screen — list, resume, empty, loading states
 *
 * Pushed from chat header via Expo Router stack navigation.
 * Taps load conversation and pop back to chat screen.
 */
import { EmptyHistoryState } from "@/components/history/conversation-item";
import { ChatConversationIndex } from "@/features/chat/model/chat-conversation";
import {
    getHistoryState,
    loadConversations,
    renameConversation
} from "@/features/chat/view-model/use-history-vm";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";

export default function HistoryScreen() {
  const historyState = getHistoryState();
  const [conversations, setConversations] = useState<ChatConversationIndex[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refresh list on focus
  useFocusEffect(
    useCallback(() => {
      refreshList();
    }, []),
  );

  // Subscribe to changes via polling (Legend State v3 beta compat)
  useEffect(() => {
    const interval = setInterval(() => {
      const convs = historyState.conversations.get();
      setConversations(convs);
      setIsLoading(historyState.isLoading.get());
      setErrorMessage(historyState.errorMessage.get());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  async function refreshList() {
    const result = await loadConversations();
    if (!result.success) {
      setErrorMessage(result.error.message);
    }
  }

  // T051: Tap conversation → pop stack → load into chat
  const handleConversationPress = useCallback(async (_id: string) => {
    // Pop back to chat screen
    router.back();
  }, []);

  // T058: Rename flow
  const handleRename = useCallback((conversation: ChatConversationIndex) => {
    Alert.prompt(
      "Renomear Conversa",
      "Novo título:",
      async (newTitle) => {
        if (newTitle && newTitle.trim()) {
          const result = await renameConversation(
            conversation.id,
            newTitle.trim(),
          );
          if (!result.success) {
            Alert.alert("Erro", result.error.message);
          }
        }
      },
      "plain-text",
      conversation.title,
    );
  }, []);

  // T059: Delete flow — implemented in Phase 6 (US4)
  // const handleDelete = useCallback((conversation: ChatConversationIndex) => {
  //   Alert.alert("Excluir Conversa", ...);
  // }, []);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-border bg-card">
        <TouchableOpacity
          onPress={() => router.back()}
          accessible
          accessibilityLabel="Voltar para o chat"
          className="mr-3"
        >
          <ArrowLeft size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-foreground text-lg font-bold flex-1">
          Histórico de Conversas
        </Text>
      </View>

      {/* Error banner */}
      {errorMessage && (
        <View className="mx-4 mt-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
        </View>
      )}

      {/* Content */}
      {isLoading && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted text-base">Carregando...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <EmptyHistoryState />
      ) : (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <View>
              <TouchableOpacity
                onPress={() => handleConversationPress(item.id)}
                onLongPress={() => handleRename(item)}
                accessible
                accessibilityLabel={`Conversa: ${item.title}`}
                accessibilityHint={`Última atualização: ${item.updatedAt}`}
                accessibilityRole="button"
                className="px-5 py-4 border-b border-border/30 bg-card active:bg-muted"
              >
                <Text
                  className="text-foreground text-base font-medium"
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text className="text-muted text-xs mt-1">
                  {formatDate(item.updatedAt)}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          keyExtractor={(item) => item.id}
        />
      )}
    </View>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}
