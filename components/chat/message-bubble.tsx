/**
 * T013: Message bubble component
 *
 * Displays a single chat message with role-based styling (user/assistant/system).
 * Uses NativeWind design tokens and @rn-primitives for consistency.
 */
import React from "react";
import { View, Text } from "react-native";
import { ChatMessage } from "@/features/chat/model/chat-message";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <View className="mx-6 my-1 items-center">
        <Text className="text-muted text-xs italic text-center">
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <View
      className={`mx-6 my-1 px-4 py-3 rounded-2xl max-w-[85%] ${
        isUser
          ? "bg-primary self-end rounded-br-md"
          : "bg-secondary self-start rounded-bl-md"
      }`}
    >
      <Text
        className={`${isUser ? "text-primary-foreground" : "text-foreground"} text-base`}
        selectable
      >
        {message.content}
      </Text>
      <Text
        className={`text-xs mt-1 ${isUser ? "text-primary-foreground/60" : "text-muted"} self-end`}
      >
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

/** Empty state component — shown when no messages exist */
export function EmptyChatState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Inicie uma conversa
      </Text>
      <Text className="text-muted text-center text-base">
        Envie uma mensagem para começar sua reflexão com IA local.
      </Text>
    </View>
  );
}

/** Loading state — shown while model is generating */
export function GeneratingIndicator() {
  return (
    <View className="mx-6 my-1 px-4 py-3 rounded-2xl rounded-bl-md bg-secondary self-start">
      <Text className="text-muted text-base">Pensando...</Text>
    </View>
  );
}
