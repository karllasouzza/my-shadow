import { ChatConversation } from "@/database/chat/types";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ConversationItemProps {
  conversation: ChatConversation;
  onPress: (id: string) => void;
  onLongPress?: (conversation: ChatConversation) => void;
}

export function ConversationItem({
  conversation,
  onPress,
  onLongPress,
}: ConversationItemProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(conversation.id)}
      onLongPress={() => onLongPress?.(conversation)}
      accessible
      accessibilityLabel={`Conversa: ${conversation.title}`}
      accessibilityHint={`Última atualização: ${formatRelativeDate(conversation.updatedAt || conversation.createdAt)}`}
      accessibilityRole="button"
      className="px-5 py-4 flex gap-1 flex-col border-b border-border bg-card active:bg-muted"
    >
      <Text className="text-foreground text-base font-medium" numberOfLines={1}>
        {conversation.title}
      </Text>
      <View className="flex flex-row justify-between">
        <Text className="text-foreground/75 text-xs truncate" numberOfLines={1}>
          {conversation.lastMessage}
        </Text>
        <Text className="text-muted-foreground/55 text-xs">
          {formatRelativeDate(conversation.updatedAt || conversation.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function formatRelativeDate(isoString: string): string {
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
