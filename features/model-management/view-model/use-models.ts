/**
 * useModels
 *
 * Hook exclusivo da ModelsScreen — zero Legend State.
 * Estado volátil com useState. Persistência via database/actions.
 */

import {
    findModelById,
    getAIRuntime,
    getAllModels,
    getModelManager,
} from "@/shared/ai";
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
  const [ramWarning, setRamWarning] = useState<{
    modelId: string;
    requiredMB: number;
    availableMB: number;
  } | null>(null);

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

  const loadModel = useCallback(
    async (modelId: string) => {
      const model = findModelById(modelId);
      if (!model) {
        setErrorMessage("Modelo não encontrado no catálogo.");
        return;
      }

      const totalRam = await DeviceInfo.getTotalMemory();
      if (totalRam < model.estimatedRamBytes) {
        setRamWarning({
          modelId,
          requiredMB: Math.round(model.estimatedRamBytes / 1024 / 1024),
          availableMB: Math.round(totalRam / 1024 / 1024),
        });
        setErrorMessage(
          `RAM insuficiente: ${Math.round(totalRam / 1024 / 1024)}MB disponível, ${Math.round(model.estimatedRamBytes / 1024 / 1024)}MB necessário.`,
        );
        return;
      }

      setRamWarning(null);
      setIsLoading(true);
      setErrorMessage(null);

      const localPath = manager.getModelLocalPath(modelId);
      if (!localPath) {
        setIsLoading(false);
        setErrorMessage(
          "Arquivo do modelo não encontrado no disco. Baixe o modelo novamente.",
        );
        return;
      }

      const runtime = getAIRuntime();
      const result = await runtime.loadModel(modelId, localPath);

      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.error.message);
      }
    },
    [manager],
  );

  const unloadModel = useCallback(async () => {
    const runtime = getAIRuntime();
    setIsLoading(true);
    const result = await runtime.unloadModel();
    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error.message);
    }
  }, []);

  return useMemo(
    () => ({
      // State
      catalog,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      ramWarning,
      downloadedModels,

      // Actions
      downloadModel,
      loadModel,
      unloadModel,
    }),
    [
      catalog,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      ramWarning,
      downloadedModels,
      downloadModel,
      loadModel,
      unloadModel,
    ],
  );
}
