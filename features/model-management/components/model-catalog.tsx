import { ModelItem } from "@/features/model-management/components/model-item";
import { CatalogEntry } from "@/features/model-management/view-model/use-models";
import React from "react";
import { FlatList, Text, View } from "react-native";
import { ModelItemStatus } from "../view-model/types";

interface ModelCatalogProps {
  models: CatalogEntry[];
  isLoading: boolean;
  statuses: Record<string, ModelItemStatus>;
  onDownload: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

type SectionHeader = { type: "header"; title: string; key: string };
type SectionItem = { type: "item"; entry: CatalogEntry };
type ListItem = SectionHeader | SectionItem;

function buildListData(models: CatalogEntry[]): ListItem[] {
  const llm = models.filter((m) => m.modelCategory === "llm");
  const whisper = models.filter((m) => m.modelCategory === "whisper");
  const items: ListItem[] = [];

  if (llm.length > 0) {
    items.push({
      type: "header",
      title: "Modelos de Linguagem (LLM)",
      key: "header-llm",
    });
    llm.forEach((e) => items.push({ type: "item", entry: e }));
  }
  if (whisper.length > 0) {
    items.push({
      type: "header",
      title: "Modelos de Voz (Whisper)",
      key: "header-whisper",
    });
    whisper.forEach((e) => items.push({ type: "item", entry: e }));
  }
  return items;
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
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-muted-foreground text-base text-center">
          Catálogo de modelos indisponível.
        </Text>
      </View>
    );
  }

  const listData = buildListData(models);

  return (
    <FlatList
      data={listData}
      style={{ flex: 1 }}
      keyExtractor={(item) =>
        item.type === "header" ? item.key : item.entry.id
      }
      renderItem={({ item }) => {
        if (item.type === "header") {
          return (
            <View className="px-5 pt-5 pb-2">
              <Text className="font-semibold text-foreground text-muted-foreground text-sm uppercase tracking-wide">
                {item.title}
              </Text>
            </View>
          );
        }
        const { entry } = item;
        return (
          <ModelItem
            item={entry}
            itemStatus={statuses[entry.id]}
            onDownload={() => onDownload(entry.id)}
            onRetry={() => onRetry(entry.id)}
            onRemove={() => onRemove(entry.id)}
            isLoading={isLoading}
          />
        );
      }}
    />
  );
}
