/**
 * Model Selector
 *
 * Dropdown simples no header do chat para selecionar/carregar modelos baixados.
 * Usa TouchableOpacity + lista inline ao invés do Select component complexo.
 */

import type { AvailableModel } from "@/shared/ai";
import { ChevronDown, ChevronUp, Cpu, Loader2 } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ModelSelectorProps {
  models: AvailableModel[];
  selectedModelId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelect: (modelId: string) => void;
}

export function ModelSelector({
  models,
  selectedModelId,
  isLoading,
  error,
  onSelect,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (modelId: string) => {
      setOpen(false);
      onSelect(modelId);
    },
    [onSelect],
  );

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const displayText = selectedModel?.displayName ?? "Selecionar modelo";

  if (models.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-2">
        <Text className="text-muted text-xs text-center">
          Nenhum modelo baixado
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 px-2">
      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="flex-row items-center justify-center gap-1 py-1"
      >
        {isLoading ? (
          <>
            <Loader2 size={14} color="#a1a1aa" />
            <Text className="text-muted text-xs">Carregando...</Text>
          </>
        ) : (
          <>
            <Cpu size={14} color={selectedModelId ? "#22c55e" : "#a1a1aa"} />
            <Text
              className="text-foreground text-xs font-medium flex-1 text-center"
              numberOfLines={1}
            >
              {displayText}
            </Text>
            {open ? (
              <ChevronUp size={14} color="#a1a1aa" />
            ) : (
              <ChevronDown size={14} color="#a1a1aa" />
            )}
          </>
        )}
      </TouchableOpacity>

      {/* Dropdown list */}
      {open && (
        <View className="absolute top-8 left-0 right-0 bg-popover rounded-lg border border-border shadow-lg shadow-black/5 z-50">
          {models.map((model) => (
            <TouchableOpacity
              key={model.id}
              onPress={() => handleSelect(model.id)}
              className={`flex-row items-center gap-2 px-3 py-2.5 border-b border-border/50 last:border-b-0 ${
                model.id === selectedModelId ? "bg-accent/50" : ""
              }`}
            >
              <Cpu size={14} color={model.isLoaded ? "#22c55e" : "#a1a1aa"} />
              <Text
                className={`flex-1 text-sm ${
                  model.isLoaded
                    ? "text-green-600 font-medium"
                    : "text-foreground"
                }`}
                numberOfLines={1}
              >
                {model.displayName}
                {model.isLoaded ? " (ativo)" : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && <Text className="text-destructive text-xs mt-1">{error}</Text>}
    </View>
  );
}
