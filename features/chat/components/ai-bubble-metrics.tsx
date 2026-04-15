import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GenerationMetrics } from "@/shared/ai/metrics";
import { Clock, Hash, Play, Zap } from "lucide-react-native";
import React from "react";
import { View } from "react-native";

type MetricsProps = { metrics: GenerationMetrics };

export function AIBubbleMetrics({ metrics }: MetricsProps) {
  return (
    <View className="w-full flex-row items-center gap-2 flex-wrap bg-muted/50 rounded-lg px-3 py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon as={Hash} className="size-3.5 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">
              {metrics.tokenCount} tok
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>
            Número estimado de tokens gerados pela resposta (contagem
            heurística)
          </Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon as={Clock} className="size-3.5 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">
              {(metrics.totalDuration / 60000).toFixed(2)} min
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo total de geração da resposta (minutos)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon as={Play} className="size-3.5 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">
              {metrics.tttf} ms
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo até o primeiro token (ms)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon as={Zap} className="size-3.5 text-muted-foreground" />
            <Text className="text-muted-foreground text-xs">
              {metrics.tokensPerSecond.toFixed(2)} tok/s
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Velocidade média de geração (tokens por segundo)</Text>
        </TooltipContent>
      </Tooltip>
    </View>
  );
}
