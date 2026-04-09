/**
 * T016: Conversation item component
 *
 * Single row in history list showing title and updatedAt.
 * Supports swipe actions for rename/delete (Phase 6).
 */
import { ChatConversationIndex } from "@/features/chat/model/chat-conversation";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ConversationItemProps {
  conversation: ChatConversationIndex;
  onPress: (id: string) => void;
}

export function ConversationItem({
  conversation,
  onPress,
}: ConversationItemProps) {
  const formattedDate = formatDate(conversation.updatedAt);

  return (
    <TouchableOpacity
      onPress={() => onPress(conversation.id)}
      accessible
      accessibilityLabel={`Conversa: ${conversation.title}`}
      accessibilityHint={`Última atualização: ${formattedDate}`}
      accessibilityRole="button"
      className="px-5 py-4 border-b border-border/30 bg-card active:bg-muted"
    >
      <Text className="text-foreground text-base font-medium" numberOfLines={1}>
        {conversation.title}
      </Text>
      <Text className="text-muted text-xs mt-1">{formattedDate}</Text>
    </TouchableOpacity>
  );
}

/** Empty state for history screen */
export function EmptyHistoryState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Nenhuma conversa ainda
      </Text>
      <Text className="text-muted text-center text-base mb-4">
        Suas conversas anteriores aparecerão aqui.
      </Text>
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
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
