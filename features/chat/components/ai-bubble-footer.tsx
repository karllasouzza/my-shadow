import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  const formattedTime = timestamp ? formatTime(timestamp) : undefined;
  const itemValue = `${modelDisplayName ?? "model"}-${formattedTime ?? "no-time"}`;

  return (
    <Accordion type="single">
      <AccordionItem value={itemValue} className="border-b-0! last:border-b-0">
        <AccordionTrigger className="w-full">
          <View className="flex-row items-center gap-1.5 flex-1">
            {modelDisplayName && (
              <Text className="text-muted-foreground text-sm">
                {modelDisplayName}
              </Text>
            )}
            {formattedTime && (
              <Text className="text-muted-foreground/55 text-sm">
                {" "}
                - {formattedTime}
              </Text>
            )}
          </View>
        </AccordionTrigger>

        <AccordionContent className="!border-none">
          <View className="w-full flex-col items-start gap-4">
            {metrics && <AIBubbleMetrics metrics={metrics} />}
          </View>
        </AccordionContent>
      </AccordionItem>
      <AIBubbleAction onRetry={onRetry} onCopy={onCopy} />
    </Accordion>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
