/**
 * AI Bubble
 *
 * Mensagem da IA — alinhada à esquerda com:
 * - Thinking section (expansível, opcional)
 * - Output principal
 * - Indicador de streaming se estiver gerando
 */

import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
import { ThinkingSection } from "@/features/chat/components/thinking-section";
import React from "react";
import { View, Text } from "react-native";
import type { ChatMessage } from "@/features/chat/model/chat-message";

interface AIBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function AIBubble({ message, isStreaming = false }: AIBubbleProps) {
  const hasThinking = !!message.thinking || (isStreaming && !message.content);
  const hasContent = !!message.content || isStreaming;

  return (
    <View className="self-start max-w-[90%] mx-4 my-1">
      {/* Thinking section (se houver) */}
      {hasThinking && (
        <ThinkingSection
          thinking={message.thinking ?? ""}
          isStreaming={isStreaming && !message.content}
        />
      )}

      {/* Output principal */}
      {hasContent && (
        <View className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
          <Text className="text-foreground text-base leading-6" selectable>
            {message.content || (isStreaming ? "" : "")}
          </Text>
          {isStreaming && !message.content && <StreamingIndicator />}
        </View>
      )}

      {/* Timestamp */}
      {message.timestamp && (
        <Text className="text-muted text-xs mt-1 px-1">
          {formatTime(message.timestamp)}
        </Text>
      )}
    </View>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
