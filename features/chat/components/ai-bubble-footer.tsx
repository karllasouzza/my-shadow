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
};

export function AIBubbleFooter({
  modelDisplayName,
  timestamp,
  metrics,
  onRetry,
}: FooterProps) {
  return (
    <View className="flex-row items-center gap-2 mt-2">
      <View className="flex-row items-center gap-1.5 flex-1 flex-wrap">
        {modelDisplayName && (
          <Text className="text-muted-foreground text-xs">
            {modelDisplayName}
          </Text>
        )}
        {timestamp && (
          <Text className="text-muted-foreground/55 text-xs">
            {" "}
            - {formatTime(timestamp)}
          </Text>
        )}

        {metrics && <AIBubbleMetrics metrics={metrics} />}
      </View>

      <AIBubbleAction onRetry={onRetry} />
    </View>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
