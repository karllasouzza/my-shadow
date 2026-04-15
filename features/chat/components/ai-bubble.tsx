/**
 * AI Bubble
 *
 * Mensagem da IA com markdown streaming em tempo real via llama.rn.
 * - ThinkingSection: colapsável, atualiza durante reasoning
 * - Output: MarkdownStream com atualização incremental
 */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/context/themes";
import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
import { ThinkingSection } from "@/features/chat/components/thinking-section";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { getAllModels } from "@/shared/ai/catalog";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import { RotateCcw } from "lucide-react-native";
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { MarkdownStream } from "react-native-markdown-stream";

interface AIBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
}

export function AIBubble({
  message,
  isStreaming = false,
  onRetry,
}: AIBubbleProps) {
  const { colorScheme } = useTheme();

  const hasThinking = !!message.thinking || (isStreaming && !message.content);
  const hasContent = !!message.content || isStreaming;

  // Get model display name
  const modelDisplayName = message.modelId
    ? (getAllModels().find((m) => m.id === message.modelId)?.displayName ??
      message.modelId)
    : null;

  // Get generation metrics if available
  const metrics = (message as any).generationMetrics as
    | GenerationMetrics
    | undefined;

  // Theme-aware markdown colors
  const markdownTextColor = colorScheme === "dark" ? "#e4e4e7" : "#18181b";
  const markdownMutedColor = colorScheme === "dark" ? "#71717a" : "#52525b";

  const theme = useMemo(
    () => ({
      base: colorScheme as "light" | "dark",
      colors: {
        textColor: markdownTextColor,
        mutedTextColor: markdownMutedColor,
      },
    }),
    [colorScheme, markdownTextColor, markdownMutedColor],
  );

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
            <MarkdownStream
              content={message.content}
              revealMode={isStreaming ? "chunk" : undefined}
              revealDelay={isStreaming ? 8 : 0}
              textColor={markdownTextColor}
              mutedTextColor={markdownMutedColor}
              enableCodeCopy={!isStreaming}
              theme={theme}
              autoStart={true}
            />
          ) : (
            isStreaming && <StreamingIndicator />
          )}
        </View>
      )}

      {/* Footer with metadata and regenerate button */}
      {!isStreaming && (
        <View className="flex-row items-center gap-2 mt-2">
          <View className="flex-row items-center gap-1.5 flex-1 flex-wrap">
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
            {metrics && (
              <>
                <Text className="text-muted-foreground/55 text-xs">•</Text>
                <Text className="text-muted-foreground/55 text-xs">
                  {metrics.tttf}ms | {metrics.tokensPerSecond.toFixed(2)} tok/s
                </Text>
              </>
            )}
          </View>

          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onPress={onRetry}
              className="h-6 px-2"
            >
              <Icon as={RotateCcw} className="size-3 text-muted-foreground" />
            </Button>
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
