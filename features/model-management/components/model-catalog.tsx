/**
 * T043: Model catalog component
 *
 * FlatList of ModelItem components. Shows all available models from catalog.
 * Empty state when catalog is empty (shouldn't happen).
 */
import {
    ModelItem,
    type ModelStatus,
} from "@/features/model-management/components/model-item";
import type { ModelCatalogEntry } from "@/shared/ai";
import React from "react";
import { FlatList, Text, View } from "react-native";

interface ModelCatalogProps {
  models: ModelCatalogEntry[];
  statuses: Record<
    string,
    { status: ModelStatus; progress: number; isLowRam: boolean }
  >;
  onDownload: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ModelCatalog({
  models,
  statuses,
  onDownload,
  onRetry,
  onRemove,
}: ModelCatalogProps) {
  if (models.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted text-center text-base">
          Catálogo de modelos indisponível.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={models}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const itemStatus = statuses[item.id] ?? {
          status: "not-downloaded" as ModelStatus,
          progress: 0,
          isLowRam: false,
        };

        return (
          <ModelItem
            item={item}
            itemStatus={itemStatus}
            onDownload={() => onDownload(item.id)}
            onRetry={() => onRetry(item.id)}
            onRemove={() => onRemove(item.id)}
          />
        );
      }}
    />
  );
}
