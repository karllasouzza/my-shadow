/**
 * useModels
 *
 * Hook exclusivo da ModelsScreen — apenas download de modelos.
 * Load/Unload agora é feito pela Chat Screen.
 */

import { findModelById, getAllModels, getModelManager } from "@/shared/ai";
import { useCallback, useMemo, useState } from "react";
import DeviceInfo from "react-native-device-info";

// ============================================================================
// Types
// ============================================================================

export interface DownloadedModelInfo {
  id: string;
  localPath: string | null;
  isLoaded: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useModels() {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const catalog = useMemo(() => getAllModels(), []);
  const manager = useMemo(() => getModelManager(), []);
  const downloadedModels = useMemo(
    () => manager.getDownloadedModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, downloadingModelId],
  );

  // ==========================================================================
  // Actions
  // ==========================================================================

  const downloadModel = useCallback(
    async (modelId: string) => {
      const model = findModelById(modelId);
      if (!model) {
        setErrorMessage("Modelo não encontrado no catálogo.");
        return;
      }

      setIsLoading(true);
      setDownloadingModelId(modelId);
      setDownloadProgress(0);
      setErrorMessage(null);

      try {
        const freeDisk = await DeviceInfo.getFreeDiskStorage("important");
        if (freeDisk < model.fileSizeBytes) {
          setErrorMessage("Espaço em disco insuficiente.");
          setIsLoading(false);
          setDownloadingModelId(null);
          return;
        }

        const { downloadModel: downloadModelFromHF } =
          await import("@react-native-ai/llama");
        const localPath = await downloadModelFromHF(model.huggingFaceId);

        manager.setDownloadedModelPath(modelId, localPath);
        setDownloadProgress(100);
        setIsLoading(false);
        setDownloadingModelId(null);
      } catch (error: unknown) {
        setIsLoading(false);
        setDownloadingModelId(null);
        setErrorMessage((error as Error)?.message ?? "Falha ao baixar modelo.");
      }
    },
    [manager],
  );

  return useMemo(
    () => ({
      // State
      catalog,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      downloadedModels,

      // Actions
      downloadModel,
    }),
    [
      catalog,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      downloadedModels,
      downloadModel,
    ],
  );
}
