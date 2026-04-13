/**
 * User Bubble
 *
 * Mensagem do usuário — alinhada à direita com cor primária.
 */

import type { ChatMessage } from "@/features/chat/model/chat-message";
import React from "react";
import { Text, View } from "react-native";

interface UserBubbleProps {
  message: ChatMessage;
}

export function UserBubble({ message }: UserBubbleProps) {
  return (
    <View className="self-end max-w-[85%]">
      <View className="bg-primary rounded-2xl rounded-br-md px-2 py-2">
        <Text className="text-primary-foreground text-base" selectable>
          {message.content}
        </Text>
      </View>
      <Text className="text-muted-foreground/55 text-xs mt-1 self-end px-1">
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
