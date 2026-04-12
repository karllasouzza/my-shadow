/**
 * AI Bubble
 *
 * Mensagem da IA — alinhada à esquerda com:
 * - Thinking section (expansível, opcional)
 * - Output principal
 * - Indicador de streaming se estiver gerando
 * - Model name + timestamp no footer
 */

import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
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

      {/* Footer: model name + timestamp */}
      {(modelDisplayName || message.timestamp) && (
        <View className="flex-row items-center gap-1.5 mt-1 px-1">
          {modelDisplayName && (
            <Text className="text-muted text-xs">{modelDisplayName}</Text>
          )}
          {modelDisplayName && message.timestamp && (
            <Text className="text-muted text-xs">•</Text>
          )}
          {message.timestamp && (
            <Text className="text-muted text-xs">
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
