import { useTheme } from "@/context/themes";
import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";
import { ThinkingSection } from "@/features/chat/components/thinking-section";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { getAllModels } from "@/shared/ai/catalog";
import type { CompletionOutput } from "@/shared/ai/types/runtime";
import * as Clipboard from "expo-clipboard";
import { useMemo } from "react";
import { Text, View } from "react-native";
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
  const content = message.content ?? "";
  const reasoning = message.reasoning_content ?? "";

  const lines = useMemo(() => {
    if (!isStreaming) return { completed: content, current: "" };
    const allLines = content.split("\n");
    const current = allLines.pop() ?? "";
    const completed = allLines.join("\n");
    return { completed, current };
  }, [content, isStreaming]);

  const hasReasoning = !!reasoning || (isStreaming && isReasonEnabled);
  const hasContent = !!content || isStreaming;

  const modelDisplayName = message.modelId
    ? (getAllModels().find((m) => m.id === message.modelId)?.displayName ??
      message.modelId)
    : null;

  const timings = (message as any).timings as
    | CompletionOutput["timings"]
    | undefined;

  const textColor = colorScheme === "dark" ? "#e4e4e7" : "#18181b";
  const mutedColor = colorScheme === "dark" ? "#71717a" : "#52525b";

  const theme = {
    base: colorScheme as "light" | "dark",
    colors: { textColor, mutedTextColor: mutedColor },
  };

  const handleCopy = async () => {
    const text = reasoning || content;
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(text);
    }
  };

  return (
    <View className="flex gap-2 self-start max-w-[100%] w-full my-6">
      {hasReasoning && (
        <ThinkingSection
          reasoning_content={reasoning}
          isStreaming={isStreaming}
        />
      )}

      {hasContent && (
        <View className="my-3 mb-0">
          {!content && isStreaming ? (
            <StreamingIndicator />
          ) : isStreaming ? (
            <View>
              {lines.completed.length > 0 && (
                <MarkdownStream
                  content={lines.completed}
                  textColor={textColor}
                  mutedTextColor={mutedColor}
                  theme={theme}
                  enableCodeCopy={false}
                />
              )}
              <Text
                className="text-base leading-relaxed"
                style={{ color: textColor }}
              >
                {lines.current}
                <Text className="opacity-50">▊</Text>
              </Text>
            </View>
          ) : (
            <MarkdownStream
              content={content}
              textColor={textColor}
              mutedTextColor={mutedColor}
              theme={theme}
              enableCodeCopy
              codeCopyLabel="Copiar"
            />
          )}
        </View>
      )}

      {!isStreaming && (
        <AIBubbleFooter
          modelDisplayName={modelDisplayName}
          timestamp={message.timestamp}
          timings={timings}
          onRetry={onRetry}
          onCopy={handleCopy}
        />
      )}
    </View>
  );
}
