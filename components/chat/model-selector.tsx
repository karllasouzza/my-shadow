/**
 * T015: Model selector component
 *
 * Badge showing loaded model name in chat header. Tap opens model picker modal.
 */
import { ChevronDown, Cpu } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ModelSelectorProps {
  modelName: string | null;
  isModelLoaded: boolean;
  onPress: () => void;
}

export function ModelSelector({
  modelName,
  isModelLoaded,
  onPress,
}: ModelSelectorProps) {
  if (!isModelLoaded || !modelName) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessible
        accessibilityLabel="Selecionar modelo"
        accessibilityRole="button"
        className="flex-row items-center gap-1 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full"
      >
        <Cpu size={14} color="#eab308" />
        <Text className="text-yellow-600 text-xs font-medium">Sem modelo</Text>
        <ChevronDown size={12} color="#eab308" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      accessible
      accessibilityLabel={`Modelo carregado: ${modelName}`}
      accessibilityRole="button"
      className="flex-row items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full"
    >
      <Cpu size={14} color="#22c55e" />
      <Text className="text-green-600 text-xs font-medium" numberOfLines={1}>
        {modelName}
      </Text>
      <ChevronDown size={12} color="#22c55e" />
    </TouchableOpacity>
  );
}

/** Placeholder while model is being loaded */
export function ModelLoadingBadge() {
  return (
    <View className="flex-row items-center gap-1 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
      <Cpu size={14} color="#3b82f6" />
      <Text className="text-blue-600 text-xs font-medium">Carregando...</Text>
    </View>
  );
}
