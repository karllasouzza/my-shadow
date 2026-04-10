/**
 * T044: Models screen — wrapped with Legend State observer
 *
 * Model Management tab content.
 * Shows catalog of available models with download/load/unload actions.
 * 5 UX states: no models, browsing, downloading, loading, failed.
 *
 * Fix: Wrapped in observer() to prevent infinite re-renders.
 * Removed polling setInterval — observer tracks observables automatically.
 */
import { syncModelStatus } from "@/features/chat/view-model/use-chat-vm";
import { DownloadProgress } from "@/features/model-management/components/download-progress";
import { ModelCatalog } from "@/features/model-management/components/model-catalog";
import type { ModelStatus } from "@/features/model-management/components/model-item";
import { RamWarning } from "@/features/model-management/components/ram-warning";
import {
  browseModels,
  downloadModel,
  getModelsState,
  loadModel,
} from "@/features/model-management/view-model/use-models-vm";
import { MODEL_CATALOG } from "@/shared/ai/model-catalog";
import { observer } from "@legendapp/state/react";
import React, { useCallback, useEffect } from "react";
import { Text, View } from "react-native";

const ModelsScreenInner = observer(function ModelsScreenInner() {
  const state = getModelsState();

  // Read observables directly — observer() tracks them
  const downloadingId = state.downloadingModelId.get();
  const progress = state.downloadProgress.get();
  const activeModelId = state.activeModel.get();
  const errorMessage = state.errorMessage.get();
  const ramWarning = state.ramWarning.get();
  const downloadedModels = state.downloadedModels.get();
  const isLoading = state.isLoading.get();

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

  // Build statuses map from observables
  const statuses: Record<
    string,
    { status: ModelStatus; progress: number; isLowRam: boolean }
  > = {};
  for (const model of MODEL_CATALOG) {
    if (downloadingId === model.id) {
      statuses[model.id] = { status: "downloading", progress, isLowRam: false };
    } else if (activeModelId === model.id) {
      statuses[model.id] = { status: "loaded", progress: 100, isLowRam: false };
    } else {
      const dl = downloadedModels.find((d) => d.id === model.id);
      const isDownloaded = dl?.localPath != null && dl.localPath.length > 0;
      statuses[model.id] = {
        status: isDownloaded ? "downloaded" : "not-downloaded",
        progress: isDownloaded ? 100 : 0,
        isLowRam: false,
      };
    }
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-foreground text-xl font-bold">
          Gerenciar Modelos
        </Text>
        <Text className="text-muted text-sm mt-1">
          Baixe e carregue modelos GGUF para inferência local.
        </Text>
      </View>

      {/* Error */}
      {errorMessage && (
        <View className="mx-5 mt-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
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
        models={MODEL_CATALOG}
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
