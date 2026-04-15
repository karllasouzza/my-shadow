import { useTheme } from "@/context/themes";
import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
import { ThinkingSection } from "@/features/chat/components/thinking-section";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { getAllModels } from "@/shared/ai/catalog";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import React, { useMemo } from "react";
import { View } from "react-native";
import { MarkdownStream } from "react-native-markdown-stream";
import { AIBubbleFooter } from "./ai-bubble-footer";

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

  const hasReasoning =
    !!message.reasoning_content || (isStreaming && !message.content);
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
      {hasReasoning && (
        <ThinkingSection
          reasoning_content={message.reasoning_content ?? ""}
          isStreaming={isStreaming && !message.content}
        />
      )}

      {/* Output principal */}
      {hasContent && (
        <View className="flex items-center justify-center my-3 mb-0">
          {message.content ? (
            <MarkdownStream
              codeCopyLabel="Copiar"
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
        <AIBubbleFooter
          modelDisplayName={modelDisplayName}
          timestamp={message.timestamp}
          metrics={metrics}
          onRetry={onRetry}
        />
      )}
    </View>
  );
}
