/**
 * Thinking Section
 *
 * Seção "Thoughts" expansível — mostra o processo de raciocínio da IA.
 * Default: collapsed. Clique para expandir.
 */

import { observer } from "@legendapp/state/react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

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

  return (
    <View className="mx-4 mt-2 mb-1">
      {/* Header clicável */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center gap-2 py-2"
        accessibilityLabel={expanded ? "Fechar pensamentos" : "Ver pensamentos"}
      >
        {expanded ? (
          <ChevronUp size={16} color="#71717a" />
        ) : (
          <ChevronDown size={16} color="#71717a" />
        )}
        <Text className="text-muted text-sm font-medium">Thoughts</Text>
        {isStreaming && !thinking && (
          <View className="flex-row gap-1 ml-2">
            <View className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
            <View className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
            <View className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
          </View>
        )}
      </TouchableOpacity>

      {/* Conteúdo expansível */}
      {expanded && (
        <View className="ml-4 pl-3 border-l-2 border-border">
          <Text className="text-muted text-sm leading-5" selectable>
            {thinking || (isStreaming ? "Pensando..." : "")}
          </Text>
        </View>
      )}
    </View>
  );
});
