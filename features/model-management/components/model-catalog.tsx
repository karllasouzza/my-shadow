import { ModelItem } from "@/features/model-management/components/model-item";
import { Model } from "@/shared/ai/types/model";
import React from "react";
import { FlatList, Text, View } from "react-native";
import { ModelItemStatus } from "../view-model/types";

interface ModelCatalogProps {
  models: Model[];
  isLoading: boolean;
  statuses: Record<string, ModelItemStatus>;
  onDownload: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ModelCatalog({
  models,
  isLoading,
  statuses,
  onDownload,
  onRetry,
  onRemove,
}: ModelCatalogProps) {
  if (models.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground text-center text-base">
          Catálogo de modelos indisponível.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={models}
      style={{ flex: 1 }}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ModelItem
          item={item}
          itemStatus={statuses[item.id]}
          onDownload={() => onDownload(item.id)}
          onRetry={() => onRetry(item.id)}
          onRemove={() => onRemove(item.id)}
          isLoading={isLoading}
        />
      )}
    />
  );
}
