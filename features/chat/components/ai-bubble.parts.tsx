import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import { Hash, Clock, Play, Zap, RotateCcw } from "lucide-react-native";

type MetricsProps = { metrics: GenerationMetrics };

export function AIBubbleMetrics({ metrics }: MetricsProps) {
  return (
    <View className="flex-row items-center gap-2 mt-1 flex-wrap">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="flex-row items-center gap-1">
            <Icon as={Hash} className="size-3 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">{metrics.tokenCount} tok</Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Número estimado de tokens gerados pela resposta (contagem heurística)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="flex-row items-center gap-1">
            <Icon as={Clock} className="size-3 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">{metrics.totalDuration} ms</Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo total de geração da resposta (ms)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="flex-row items-center gap-1">
            <Icon as={Play} className="size-3 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">{metrics.tttf} ms</Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo até o primeiro token (ms)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="flex-row items-center gap-1">
            <Icon as={Zap} className="size-3 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">{metrics.tokensPerSecond.toFixed(2)} tok/s</Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Velocidade média de geração (tokens por segundo)</Text>
        </TooltipContent>
      </Tooltip>
    </View>
  );
}

type ActionProps = { onRetry?: () => void };
export function AIBubbleAction({ onRetry }: ActionProps) {
  if (!onRetry) return null;
  return (
    <Button variant="ghost" size="sm" onPress={onRetry} className="h-6 px-2">
      <Icon as={RotateCcw} className="size-3 text-muted-foreground" />
    </Button>
  );
}

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
          <Text className="text-muted-foreground/55 text-xs">{modelDisplayName}</Text>
        )}
        {modelDisplayName && formattedTime && (
          <Text className="text-muted-foreground/55 text-xs">•</Text>
        )}
        {formattedTime && (
          <Text className="text-muted-foreground/55 text-xs">{formattedTime}</Text>
        )}

        {metrics && <AIBubbleMetrics metrics={metrics} />}
      </View>

      <AIBubbleAction onRetry={onRetry} />
    </View>
  );
}
