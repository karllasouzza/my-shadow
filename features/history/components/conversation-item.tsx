import ConversationDropdownMenu from "@/components/ui/conversation-dropdown-menu";
import { ChatConversation } from "@/database/chat/types";
import React from "react";
import { Pressable, Text, View } from "react-native";

interface ConversationItemProps {
  conversation: ChatConversation;
  onPress: (id: string) => void;
  onLongPress?: (conversation: ChatConversation) => void;
  onRename?: (conversation: ChatConversation) => void;
  onDelete?: (conversation: ChatConversation) => void;
}

export function ConversationItem({
  conversation,
  onPress,
  onLongPress,
  onRename,
  onDelete,
}: ConversationItemProps) {
  return (
    <Pressable
      onPress={() => onPress(conversation.id)}
      onLongPress={() => onLongPress?.(conversation)}
      accessible
      accessibilityLabel={`Conversa: ${conversation.title}`}
      accessibilityHint={`Última atualização: ${formatRelativeDate(
        conversation.updatedAt || conversation.createdAt,
      )}`}
      accessibilityRole="button"
      className="px-5 py-4 border-b border-border bg-card active:bg-muted"
    >
      <Text
        className="text-foreground text-base font-medium mb-1"
        numberOfLines={1}
      >
        {conversation.title}
      </Text>

      <View className="flex flex-row items-center justify-between">
        <Text
          className="text-foreground/75 text-xs truncate flex-1 pr-3"
          numberOfLines={1}
        >
          {conversation.lastMessage}
        </Text>

        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground/55 text-xs">
            {formatRelativeDate(
              conversation.updatedAt || conversation.createdAt,
            )}
          </Text>

          <ConversationDropdownMenu
            conversation={conversation}
            onRename={(c) => onRename?.(c)}
            onDelete={(c) => onDelete?.(c)}
          />
        </View>
      </View>
    </Pressable>
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
