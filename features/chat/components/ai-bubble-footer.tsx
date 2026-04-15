import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import { AIBubbleMetrics } from "./ai-bubble-metrics";
import { AIBubbleAction } from "./ai-bubble-action";

type FooterProps = {
  modelDisplayName?: string | null;
  formattedTime?: string | undefined;
  metrics?: GenerationMetrics | undefined;
  onRetry?: () => void;
};

export function AIBubbleFooter({ modelDisplayName, formattedTime, metrics, onRetry }: FooterProps) {
  return (
    <View className="flex-row items-center gap-2 mt-2">
      <View className="flex-row items-center gap-1.5 flex-1 flex-wrap">
        {modelDisplayName && (
          <Text className="text-muted-foreground text-xs">{modelDisplayName}</Text>
        )}
        {formattedTime && (
          <Text className="text-muted-foreground/55 text-xs"> - {formattedTime}</Text>
        )}

        {metrics && <AIBubbleMetrics metrics={metrics} />}
      </View>

      <AIBubbleAction onRetry={onRetry} />
    </View>
  );
}
