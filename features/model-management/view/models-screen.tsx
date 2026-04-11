/**
 * Models Screen
 *
 * Apenas catálogo de downloads — load/unload é feito na Chat Screen.
 */

import { DownloadProgress } from "@/features/model-management/components/download-progress";
import { ModelCatalog } from "@/features/model-management/components/model-catalog";
import type { ModelStatus } from "@/features/model-management/components/model-item";
import { useModels } from "@/features/model-management/view-model/use-models";
import { observer } from "@legendapp/state/react";
import React, { useCallback, useMemo } from "react";
import { Text, View } from "react-native";

const ModelsScreenInner = observer(function ModelsScreenInner() {
  const {
    catalog,
    isLoading,
    downloadingModelId,
    downloadProgress,
    errorMessage,
    downloadedModels,
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

  // Build statuses — modelos na tela de models são apenas downloaded/not-downloaded
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
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-foreground text-xl font-bold">
          Catálogo de Modelos
        </Text>
        <Text className="text-muted text-xs mt-1">
          Baixe modelos para usar no chat. Selecione e carregue na tela de chat.
        </Text>
      </View>

      {/* Error */}
      {errorMessage && (
        <View className="mx-5 mt-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
        </View>
      )}

      {/* Download Progress */}
      {downloadingModelId && (
        <DownloadProgress
          progress={downloadProgress}
          modelName={downloadingModelId}
        />
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
