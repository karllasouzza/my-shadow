import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CompletionTimings } from "@/shared/ai/text-generation/types";
import React from "react";
import { View } from "react-native";

type MetricsProps = {
  timings?: CompletionTimings | null;
};

export function AIBubbleMetrics({ timings }: MetricsProps) {
  if (!timings) {
    return null;
  }

  const generatedTokens = timings.generatedTokens;
  const promptTokens = timings.promptTokens;
  const totalDurationMs = timings.totalMs;
  const firstTokenMs = timings.timeToFirstToken;
  const tokensPerSecond = timings.tokensPerSecond;

  return (
    <View className="w-full flex-row items-center gap-2 flex-wrap bg-muted/50 rounded-lg px-3 py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon
              as={require("lucide-react-native").Hash}
              className="size-3.5 text-muted-foreground"
            />
            <Text className="text-muted-foreground text-xs">
              {generatedTokens} tok
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tokens de resposta gerados (predicted_n)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon
              as={require("lucide-react-native").Hash}
              className="size-3.5 text-muted-foreground"
            />
            <Text className="text-muted-foreground text-xs">
              {promptTokens} tok prompt
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tokens de entrada processados no prompt</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon
              as={require("lucide-react-native").Clock}
              className="size-3.5 text-muted-foreground"
            />
            <Text className="text-muted-foreground text-xs">
              {(totalDurationMs / 1000).toFixed(2)} s
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo total da geração (prompt + decode)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon
              as={require("lucide-react-native").Play}
              className="size-3.5 text-muted-foreground"
            />
            <Text className="text-muted-foreground text-xs">
              {firstTokenMs.toFixed(0)} ms
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo até o primeiro token (TTFT)</Text>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="flex-row items-center gap-1.5 py-1"
          >
            <Icon
              as={require("lucide-react-native").Zap}
              className="size-3.5 text-muted-foreground"
            />
            <Text className="text-muted-foreground text-xs">
              {tokensPerSecond.toFixed(2)} tok/s
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
