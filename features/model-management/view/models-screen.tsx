import { TopBar } from "@/components/top-bar";
import { ModelCatalog } from "@/features/model-management/components/model-catalog";
import type { ModelStatus } from "@/features/model-management/components/model-item";
import { useModels } from "@/features/model-management/view-model/use-models";
import { observer } from "@legendapp/state/react";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Text, View } from "react-native";

const ModelsScreenInner = observer(function ModelsScreenInner() {
  const router = useRouter();
  const {
    catalog,
    isLoading,
    downloadingModelId,
    downloadProgress,
    errorMessage,
    downloadedModels,
    searchQuery,
    setSearchQuery,
    downloadModel,
  } = useModels();

  const handleDownload = useCallback(
    async (modelId: string) => {
      await downloadModel(modelId);
    },
    [downloadModel],
  );

  const handleRetry = useCallback(
    async (modelId: string) => {
      await handleDownload(modelId);
    },
    [handleDownload],
  );

  const statuses: Record<
    string,
    { status: ModelStatus; progress: number; isLowRam: boolean }
  > = useMemo(() => {
    const map: Record<
      string,
      { status: ModelStatus; progress: number; isLowRam: boolean }
    > = {};
    for (const model of catalog) {
      if (downloadingModelId === model.id) {
        map[model.id] = {
          status: "downloading",
          progress: downloadProgress,
          isLowRam: false,
        };
      } else {
        const isDownloaded = model.id in downloadedModels;
        map[model.id] = {
          status: isDownloaded ? "downloaded" : "not-downloaded",
          progress: isDownloaded ? 100 : 0,
          isLowRam: false,
        };
      }
    }
    return map;
  }, [catalog, downloadingModelId, downloadProgress, downloadedModels]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <TopBar
        title="Gerenciamento de Modelos"
        showBack
        onBack={() => router.back()}
        showSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar modelo..."
      />

      {/* Error */}
      {errorMessage && (
        <View className="mx-5 mt-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
        </View>
      )}

      {/* Model Catalog */}
      <ModelCatalog
        models={catalog}
        statuses={statuses}
        onDownload={handleDownload}
        onRetry={handleRetry}
      />

      {/* Loading overlay */}
      {isLoading && !downloadingModelId && (
        <View className="absolute inset-0 bg-background/80 items-center justify-center">
          <Text className="text-muted text-base">Carregando...</Text>
        </View>
      )}
    </View>
  );
});

export const ModelsScreen = React.memo(function ModelsScreen() {
  return <ModelsScreenInner />;
});
