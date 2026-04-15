import { Text } from "@/components/ui/text";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import React from "react";
import { View } from "react-native";
import { AIBubbleAction } from "./ai-bubble-action";
import { AIBubbleMetrics } from "./ai-bubble-metrics";

type FooterProps = {
  modelDisplayName?: string | null;
  timestamp?: string | undefined;
  metrics?: GenerationMetrics | undefined;
  onRetry?: () => void;
  onCopy?: () => void;
};

export function AIBubbleFooter({
  modelDisplayName,
  timestamp,
  metrics,
  onRetry,
  onCopy,
}: FooterProps) {
  return (
    <View className="w-full flex-col items-start gap-4 mt-2">
      <View className="flex-row items-center gap-1.5 flex-1">
        {modelDisplayName && (
          <Text className="text-muted-foreground text-sm">
            {modelDisplayName}
          </Text>
        )}
        {timestamp && (
          <Text className="text-muted-foreground/55 text-sm">
            {" "}
            - {formatTime(timestamp)}
          </Text>
        )}
      </View>

      {metrics && <AIBubbleMetrics metrics={metrics} />}
      <AIBubbleAction onRetry={onRetry} onCopy={onCopy} />
    </View>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
