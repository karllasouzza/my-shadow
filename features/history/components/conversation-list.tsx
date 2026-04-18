import { ChatConversation } from "@/database/chat/types";
import { ConversationItem } from "@/features/history/components/conversation-item";
import React from "react";
import { FlatList } from "react-native";

interface ConversationListProps {
  conversations: ChatConversation[];
  onPress: (id: string) => void;
  onLongPress?: (conv: ChatConversation) => void;
}

export function ConversationList({
  conversations,
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
    />
  );
}
