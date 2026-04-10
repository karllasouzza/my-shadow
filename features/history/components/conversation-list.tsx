/**
 * T054: Conversation list component
 *
 * FlatList of ConversationItem components with pull-to-refresh.
 */
import type { ChatConversationIndex } from "@/features/chat/model/chat-conversation";
import { ConversationItem } from "@/features/history/components/conversation-item";
import React from "react";
import { FlatList, RefreshControl } from "react-native";

interface ConversationListProps {
  conversations: ChatConversationIndex[];
  isLoading: boolean;
  onRefresh: () => void;
  onPress: (id: string) => void;
  onLongPress?: (conv: ChatConversationIndex) => void;
}

export function ConversationList({
  conversations,
  isLoading,
  onRefresh,
  onPress,
  onLongPress,
}: ConversationListProps) {
  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ConversationItem
          conversation={item}
          onPress={onPress}
          onLongPress={onLongPress}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
          colors={["#3b82f6"]}
        />
      }
    />
  );
}
