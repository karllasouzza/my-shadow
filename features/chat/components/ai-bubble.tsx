import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
import { StreamingText } from "@/features/chat/components/streaming-text";
import { ThinkingSection } from "@/features/chat/components/thinking-section";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { getAllModels } from "@/shared/ai/catalog";
import React from "react";
import { Text, View } from "react-native";

interface AIBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function AIBubble({ message, isStreaming = false }: AIBubbleProps) {
  const hasThinking = !!message.thinking || (isStreaming && !message.content);
  const hasContent = !!message.content || isStreaming;

  // Get model display name
  const modelDisplayName = message.modelId
    ? (() => {
        const catalog = getAllModels();
        const entry = catalog.find((m) => m.id === message.modelId);
        return entry?.displayName ?? message.modelId;
      })()
    : null;

  return (
    <View className="flex gap-2 self-start max-w-[100%] w-full my-6">
      {/* Thinking section */}
      {hasThinking && (
        <ThinkingSection
          thinking={message.thinking ?? ""}
          isStreaming={isStreaming && !message.content}
        />
      )}

      {/* Output principal */}
      {hasContent && (
        <View className="py-3">
          {message.content ? (
            <StreamingText
              text={message.content}
              className="text-foreground text-base leading-6"
              selectable
              autoScroll={isStreaming}
            />
          ) : (
            isStreaming && <StreamingIndicator />
          )}
        </View>
      )}

      {/* Footer: model name + timestamp */}
      {(modelDisplayName || message.timestamp) && (
        <View className="flex-row items-center gap-1.5 mt-1">
          {modelDisplayName && (
            <Text className="text-muted-foreground/55 text-xs">
              {modelDisplayName}
            </Text>
          )}
          {modelDisplayName && message.timestamp && (
            <Text className="text-muted-foreground/55 text-xs">•</Text>
          )}
          {message.timestamp && (
            <Text className="text-muted-foreground/55 text-xs">
              {formatTime(message.timestamp)}
            </Text>
          )}
        </View>
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
