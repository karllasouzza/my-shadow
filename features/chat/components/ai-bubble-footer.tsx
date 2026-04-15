import { Text } from "@/components/ui/text";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import React from "react";
import { View } from "react-native";
import { AIBubbleAction } from "./ai-bubble-action";
import { AIBubbleMetrics } from "./ai-bubble-metrics";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

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
  const formattedTime = timestamp ? formatTime(timestamp) : undefined;
  const itemValue = `${modelDisplayName ?? "model"}-${formattedTime ?? "no-time"}`;

  return (
    <Accordion>
      <AccordionItem value={itemValue}>
        <AccordionTrigger className="w-full">
          <View className="flex-row items-center gap-1.5 flex-1">
            {modelDisplayName && (
              <Text className="text-muted-foreground text-sm">{modelDisplayName}</Text>
            )}
            {formattedTime && (
              <Text className="text-muted-foreground/55 text-sm"> - {formattedTime}</Text>
            )}
          </View>
        </AccordionTrigger>

        <AccordionContent>
          <View className="w-full flex-col items-start gap-4 mt-2">
            {metrics && <AIBubbleMetrics metrics={metrics} />}
            <AIBubbleAction onRetry={onRetry} onCopy={onCopy} />
          </View>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
