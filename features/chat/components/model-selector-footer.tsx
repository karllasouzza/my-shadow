/**
 * T047: Model selector footer component
 *
 * Compact model selector in chat footer/actions bar.
 * Shows current model name (or "Sem modelo"). Tap opens ModelPicker modal.
 * Used when no model is loaded or user taps to switch.
 */
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { Cpu } from "lucide-react-native";

interface ModelSelectorFooterProps {
  modelName: string | null;
  isLoaded: boolean;
  onPress: () => void;
}

export function ModelSelectorFooter({ modelName, isLoaded, onPress }: ModelSelectorFooterProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessible
      accessibilityLabel={isLoaded ? `Modelo ativo: ${modelName}` : "Selecionar modelo"}
      accessibilityRole="button"
      className="flex-row items-center gap-2 px-4 py-2 bg-card border-t border-border"
    >
      <Cpu size={16} color={isLoaded ? "#22c55e" : "#eab308"} />
      <Text
        className={`text-sm ${isLoaded ? "text-green-600" : "text-yellow-600"}`}
        numberOfLines={1}
      >
        {isLoaded ? modelName : "Sem modelo — toque para selecionar"}
      </Text>
    </TouchableOpacity>
  );
}
