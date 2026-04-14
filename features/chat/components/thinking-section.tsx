/**
 * Thinking Section
 *
 * Seção "Thoughts" expansível.
 * Colapsado: preview com StreamingText (4 linhas, auto-scroll bottom).
 * Expandido: texto completo via StreamingText, sem limite.
 */

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { observer } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StreamingText } from "./streaming-text";

interface ThinkingSectionProps {
  thinking: string;
  isStreaming?: boolean;
}

export const ThinkingSection = observer(function ThinkingSection({
  thinking,
  isStreaming = false,
}: ThinkingSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!thinking && !isStreaming) return null;

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <View className="w-full border border-border rounded-2xl bg-background mb-1">
      <View className="flex flex-col">
        {/* Header */}
        <TouchableOpacity
          onPress={toggleExpanded}
          className="flex-row justify-between items-center gap-2 p-3 z-10"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={
            expanded ? "Fechar pensamentos" : "Ver pensamentos"
          }
          accessibilityRole="button"
        >
          <Text
            className={cn(
              "text-muted-foreground text-xs font-semibold uppercase tracking-wide",
              isStreaming && !thinking && "opacity-60",
            )}
          >
            {isStreaming && !thinking
              ? "Pensando…"
              : expanded
                ? "Esconder pensamentos"
                : "Ver pensamentos"}
          </Text>

          {expanded ? (
            <Icon as={ChevronUp} className="size-3 text-muted-foreground" />
          ) : (
            <Icon as={ChevronDown} className="size-3 text-muted-foreground" />
          )}
        </TouchableOpacity>

        {/* Content */}
        <View className="px-3 pb-3">
          {expanded ? (
            <StreamingText
              text={thinking}
              className="text-muted-foreground text-sm leading-5"
              selectable
            />
          ) : (
            <StreamingText
              text={thinking || (isStreaming ? "Pensando…" : "")}
              className="text-muted-foreground text-sm leading-5"
              selectable
              autoScroll={isStreaming}
              numberOfLines={4}
            />
          )}
        </View>
      </View>
    </View>
  );
});
