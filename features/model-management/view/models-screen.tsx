/**
 * T044: Models screen
 *
 * Model Management tab content.
 * Shows catalog of available models with download/load/unload actions.
 * 5 UX states: no models, browsing, downloading, loading, failed.
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
    type ModelsState,
} from "@/features/model-management/view-model/use-models-vm";
import { MODEL_CATALOG } from "@/shared/ai/model-catalog";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";

export function ModelsScreen() {
  const state = getModelsState();
  const [_tick, setTick] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ramWarning, setRamWarning] = useState<{
    modelId: string;
    requiredMB: number;
    availableMB: number;
  } | null>(null);

  // Poll Legend State
  useEffect(() => {
    browseModels();
    const interval = setInterval(() => {
      const ms = state as ModelsState;
      setProgress(ms.downloadProgress.get());
      setDownloadingId(ms.downloadingModelId.get());
      setActiveModelId(ms.activeModel.get());
      setErrorMessage(ms.errorMessage.get());
      setRamWarning(ms.ramWarning.get());
      setTick((t) => t + 1);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async (modelId: string) => {
    setDownloadingId(modelId);
    await downloadModel(modelId);
    setDownloadingId(null);
  };

  const handleLoad = async (modelId: string) => {
    await loadModel(modelId, async () => {
      await syncModelStatus();
    });
  };

  const handleRetry = async (modelId: string) => {
    await handleDownload(modelId);
  };

  // Build statuses map
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
      statuses[model.id] = {
        status: "not-downloaded",
        progress: 0,
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
    </View>
  );
}
