import { useTheme } from "@/context/themes";
import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
import { ThinkingSection } from "@/features/chat/components/thinking-section";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { getAllModels } from "@/shared/ai/catalog";
import type { CompletionOutput } from "@/shared/ai/types/runtime";
import * as Clipboard from "expo-clipboard";
import React, { useMemo } from "react";
import { View } from "react-native";
import { MarkdownStream } from "react-native-markdown-stream";
import { AIBubbleFooter } from "./ai-bubble-footer";

interface AIBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isReasonEnabled?: boolean;
  onRetry?: () => void;
}

export function AIBubble({
  message,
  isStreaming = false,
  onRetry,
  isReasonEnabled,
}: AIBubbleProps) {
  const { colorScheme } = useTheme();

  const hasReasoning =
    !!message.reasoning_content || !!(isStreaming && isReasonEnabled);
  const hasContent = !!message.content || isStreaming;

  // Get model display name
  const modelDisplayName = message.modelId
    ? (getAllModels().find((m) => m.id === message.modelId)?.displayName ??
      message.modelId)
    : null;

  const timings = (message as any).timings as
    | CompletionOutput["timings"]
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

  const handleCopyContent = async () => {
    const textToCopy = message.reasoning_content ?? message.content;
    if (!textToCopy) return;
    try {
      await Clipboard.setStringAsync(textToCopy);
    } catch (e) {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(textToCopy);
        } catch {}
      }
    }
  };

  return (
    <View className="flex gap-2 self-start max-w-[100%] w-full my-6">
      {/* Thinking section */}
      {hasReasoning && (
        <ThinkingSection
          reasoning_content={message.reasoning_content ?? ""}
          isStreaming={isStreaming}
        />
      )}

      {/* Output principal */}
      {hasContent && (
        <View className="flex items-center justify-center my-3 mb-0">
          {message.content ? (
            <MarkdownStream
              codeCopyLabel="Copiar"
              source={isStreaming ? message.content : undefined}
              content={!isStreaming ? message.content : undefined}
              textColor={markdownTextColor}
              mutedTextColor={markdownMutedColor}
              enableCodeCopy={!isStreaming}
              theme={theme}
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
          timings={timings}
          onRetry={onRetry}
          onCopy={handleCopyContent}
        />
      )}
    </View>
  );
}
