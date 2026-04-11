/**
 * Models Screen
 *
 * Gerenciamento de modelos com synced() store.
 */

import { syncModelStatus } from "@/features/chat/view-model/use-chat-vm";
import { DownloadProgress } from "@/features/model-management/components/download-progress";
import { ModelCatalog } from "@/features/model-management/components/model-catalog";
import type { ModelStatus } from "@/features/model-management/components/model-item";
import { RamWarning } from "@/features/model-management/components/ram-warning";
import {
    browseModels,
    downloadModel,
    getActiveModelId,
    getCatalog,
    getDownloadProgress,
    getDownloadingModelId,
    getErrorMessage,
    getIsLoading,
    getRamWarning,
    loadModel,
} from "@/features/model-management/view-model/use-models-vm";
import { getModelManager } from "@/shared/ai";
import { observer } from "@legendapp/state/react";
import React, { useCallback, useEffect, useMemo } from "react";
import { Text, View } from "react-native";

const ModelsScreenInner = observer(function ModelsScreenInner() {
  const catalog = getCatalog();
  const downloadingId = getDownloadingModelId();
  const progress = getDownloadProgress();
  const activeModelId = getActiveModelId();
  const errorMsg = getErrorMessage();
  const ramWarning = getRamWarning();
  const isLoading = getIsLoading();

  const manager = useMemo(() => getModelManager(), []);
  const downloadedModels = useMemo(
    () => manager.getDownloadedModels(),
    [manager, downloadingId, activeModelId],
  );

  useEffect(() => {
    browseModels();
  }, []);

  const handleDownload = useCallback(async (modelId: string) => {
    await downloadModel(modelId);
  }, []);

  const handleLoad = useCallback(async (modelId: string) => {
    await loadModel(modelId, async () => {
      await syncModelStatus();
    });
  }, []);

  const handleRetry = useCallback(
    async (modelId: string) => {
      await handleDownload(modelId);
    },
    [handleDownload],
  );

  // Build statuses map
  const statuses: Record<
    string,
    { status: ModelStatus; progress: number; isLowRam: boolean }
  > = useMemo(() => {
    const map: Record<
      string,
      { status: ModelStatus; progress: number; isLowRam: boolean }
    > = {};
    for (const model of catalog) {
      if (downloadingId === model.id) {
        map[model.id] = { status: "downloading", progress, isLowRam: false };
      } else if (activeModelId === model.id) {
        map[model.id] = { status: "loaded", progress: 100, isLowRam: false };
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
  }, [catalog, downloadingId, progress, activeModelId, downloadedModels]);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-foreground text-xl font-bold">
          Gerenciar Modelos
        </Text>
      </View>

      {/* Error */}
      {errorMsg && (
        <View className="mx-5 mt-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMsg}</Text>
        </View>
      )}

      {/* RAM Warning */}
      {ramWarning && (
        <RamWarning
          requiredMB={ramWarning.requiredMB}
          availableMB={ramWarning.availableMB}
        />
      )}

      {/* Download Progress */}
      {downloadingId && (
        <DownloadProgress progress={progress} modelName={downloadingId} />
      )}

      {/* Model Catalog */}
      <ModelCatalog
        models={catalog}
        statuses={statuses}
        onDownload={handleDownload}
        onLoad={handleLoad}
        onRetry={handleRetry}
      />

      {/* Loading overlay */}
      {isLoading && !downloadingId && (
        <View className="absolute inset-0 bg-background/80 items-center justify-center">
          <Text className="text-muted text-base">Carregando...</Text>
        </View>
      )}
    </View>
  );
});

export function ModelsScreen() {
  return <ModelsScreenInner />;
}
