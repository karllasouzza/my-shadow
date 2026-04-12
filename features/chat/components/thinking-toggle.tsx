/**
 * Thinking Toggle
 *
 * Button to enable/disable the AI's reasoning process.
 * Only shown when the current model supports reasoning.
 */

import { Brain } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ThinkingToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function ThinkingToggle({ enabled, onToggle }: ThinkingToggleProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
        enabled
          ? "bg-primary/10 border-primary/30"
          : "bg-transparent border-border"
      }`}
      accessibilityLabel={
        enabled ? "Desabilitar pensamento" : "Habilitar pensamento"
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
    >
      <Brain size={14} color={enabled ? "#3b82f6" : "#a1a1aa"} />
      <Text
        className={`text-xs font-medium ${enabled ? "text-primary" : "text-muted"}`}
      >
        Thinking
      </Text>
      <View
        className={`w-8 h-4 rounded-full ${enabled ? "bg-primary" : "bg-muted"} justify-center`}
        style={{ justifyContent: "center" }}
      >
        <View
          className={`w-3 h-3 rounded-full bg-white`}
          style={{
            alignSelf: enabled ? "flex-end" : "flex-start",
            marginRight: enabled ? 2 : 0,
            marginLeft: enabled ? 0 : 2,
          }}
        />
      </View>
    </TouchableOpacity>
  );
}
