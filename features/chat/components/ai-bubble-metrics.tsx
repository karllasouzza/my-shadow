import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CompletionOutput } from "@/shared/ai/text-generation/types";
import React from "react";
import { View } from "react-native";

type RuntimeTimings = CompletionOutput["timings"];

type MetricsProps = {
  timings?: RuntimeTimings;
};

export function AIBubbleMetrics({ timings }: MetricsProps) {
  if (!timings) {
    return null;
  }

  const generatedTokens = timings.predicted_n;
  const promptTokens = timings.prompt_n;
  const cacheTokens = timings.cache_n;

  const totalDurationMs = timings.prompt_ms + timings.predicted_ms;

  const firstPhaseMs = timings.prompt_ms;

  const tokensPerSecond =
    timings.predicted_per_second > 0
      ? timings.predicted_per_second
      : timings.predicted_ms > 0
        ? (timings.predicted_n / timings.predicted_ms) * 1000
        : 0;

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
              {cacheTokens} tok cache
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tokens atuais no KV cache (cache_n)</Text>
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
          <Text>Tokens de entrada processados no prompt (prompt_n)</Text>
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
              {firstPhaseMs.toFixed(0)} ms
            </Text>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <Text>Tempo de processamento do prompt (prompt_ms)</Text>
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
