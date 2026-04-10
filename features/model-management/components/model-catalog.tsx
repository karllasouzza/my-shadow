/**
 * T043: Model catalog component
 *
 * FlatList of ModelItem components. Shows all available models from catalog.
 * Empty state when catalog is empty (shouldn't happen).
 */
import React from "react";
import { FlatList, View, Text } from "react-native";
import { ModelItem, type ModelStatus } from "@/features/model-management/components/model-item";
import type { ModelCatalogEntry } from "@/shared/ai/catalog";

interface ModelCatalogProps {
  models: ModelCatalogEntry[];
  statuses: Record<string, { status: ModelStatus; progress: number; isLowRam: boolean }>;
  onDownload: (id: string) => void;
  onLoad: (id: string) => void;
  onRetry: (id: string) => void;
}

export function ModelCatalog({ models, statuses, onDownload, onLoad, onRetry }: ModelCatalogProps) {
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
        const s = statuses[item.id] ?? { status: "not-downloaded" as ModelStatus, progress: 0, isLowRam: false };
        return (
          <ModelItem
            name={item.displayName}
            description={item.description}
            sizeMB={Math.round(item.fileSizeBytes / 1024 / 1024)}
            ramMB={Math.round(item.estimatedRamBytes / 1024 / 1024)}
            status={s.status}
            progress={s.progress}
            isLowRam={s.isLowRam}
            onDownload={() => onDownload(item.id)}
            onLoad={() => onLoad(item.id)}
            onRetry={() => onRetry(item.id)}
          />
        );
      }}
    />
  );
}
