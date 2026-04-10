/**
 * T055: Conversation item component
 *
 * Shows title + formatted relative date (e.g., "2h atrás", "3d atrás").
 * Tap → switch to Chat tab + load conversation.
 * Long-press → action sheet for rename/delete (Phase 6).
 */
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import type { ChatConversationIndex } from "@/features/chat/model/chat-conversation";

interface ConversationItemProps {
  conversation: ChatConversationIndex;
  onPress: (id: string) => void;
  onLongPress?: (conversation: ChatConversationIndex) => void;
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
      accessibilityHint={`Última atualização: ${formatRelativeDate(conversation.updatedAt)}`}
      accessibilityRole="button"
      className="px-5 py-4 border-b border-border/30 bg-card active:bg-muted"
    >
      <Text
        className="text-foreground text-base font-medium"
        numberOfLines={1}
      >
        {conversation.title}
      </Text>
      <Text className="text-muted text-xs mt-1">
        {formatRelativeDate(conversation.updatedAt)}
      </Text>
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
