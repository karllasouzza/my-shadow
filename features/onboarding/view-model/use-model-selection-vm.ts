/**
 * Onboarding: Model Selection ViewModel
 *
 * Manages state and actions for the model selection screen.
 * Filters MODEL_CATALOG by device RAM budget (from DeviceDetector).
 * Uses ModelManager for downloads.
 * All text/state in Brazilian Portuguese context.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MODEL_CATALOG,
  type AvailableModel,
  type ModelConfiguration,
} from "../model/model-configuration";
import { getModelRepository } from "../repository/model-repository";
import { getDeviceInfo } from "../service/device-detector";
import { getModelManager } from "../service/model-manager";

export interface ModelItem extends AvailableModel {
  isCompatible: boolean;
  incompatibilityReason?: string;
  isRecommended: boolean;
  isDownloaded: boolean;
}

export interface ModelSelectionState {
  compatibleModels: ModelItem[];
  selectedModel: ModelItem | null;
  downloadProgress: number;
  isLoading: boolean;
  error: string | null;
  isDownloading: boolean;
  downloadComplete: boolean;
}

export interface UseModelSelectionVm {
  state: ModelSelectionState;
  actions: {
    selectModel: (model: ModelItem) => void;
    startDownload: () => Promise<void>;
    cancelDownload: () => void;
    retryDownload: () => Promise<void>;
    selectCustomFolder: () => void;
    clearError: () => void;
  };
}

export const useModelSelectionVm = (): UseModelSelectionVm => {
  const modelManager = getModelManager();
  const modelRepository = getModelRepository();
  const downloadStartedRef = useRef(false);

  const [state, setState] = useState<ModelSelectionState>({
    compatibleModels: [],
    selectedModel: null,
    downloadProgress: 0,
    isLoading: true,
    error: null,
    isDownloading: false,
    downloadComplete: false,
  });

  // Initialize: detect device capabilities and filter models
  useEffect(() => {
    const init = async () => {
      try {
        const deviceInfo = await getDeviceInfo();
        const ramBudget60 = deviceInfo.ramBudget60;

        const modelItems: ModelItem[] = MODEL_CATALOG.map((model) => {
          const isCompatible = model.estimatedRamBytes <= ramBudget60;
          const isRecommended =
            model.estimatedRamBytes <= ramBudget60 &&
            model.estimatedRamBytes ===
              Math.max(
                ...MODEL_CATALOG.filter(
                  (m) => m.estimatedRamBytes <= ramBudget60,
                ).map((m) => m.estimatedRamBytes),
              );
          const isDownloaded = modelRepository.hasDownloadedModel(model.key);

          return {
            ...model,
            isCompatible,
            isRecommended,
            isDownloaded,
            incompatibilityReason: !isCompatible
              ? `Requer ${formatBytes(model.estimatedRamBytes)} de RAM. Seu dispositivo tem ${formatBytes(deviceInfo.totalRamBytes)} total.`
              : undefined,
          };
        });

        setState((s) => ({
          ...s,
          compatibleModels: modelItems,
          isLoading: false,
          selectedModel:
            modelItems.find((m) => m.isRecommended) ??
            modelItems.find((m) => m.isCompatible) ??
            null,
        }));
      } catch {
        setState((s) => ({
          ...s,
          isLoading: false,
          error:
            "Nao foi possível detectar as capacidades do dispositivo. Tente novamente.",
        }));
      }
    };

    init();
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const selectModel = useCallback((model: ModelItem) => {
    if (!model.isCompatible) return;
    setState((s) => ({
      ...s,
      selectedModel: model,
      error: null,
    }));
  }, []);

  const startDownload = useCallback(async () => {
    if (!state.selectedModel || state.isDownloading) return;

    const model = state.selectedModel;
    downloadStartedRef.current = true;

    setState((s) => ({
      ...s,
      isDownloading: true,
      downloadProgress: 0,
      error: null,
      downloadComplete: false,
    }));

    const progressInterval = setInterval(() => {
      const progress = modelManager.getDownloadProgress();
      setState((s) => ({ ...s, downloadProgress: progress }));
    }, 200);

    try {
      const result = await modelManager.downloadModel(
        model.downloadUrl,
        undefined,
        (progress) => {
          setState((s) => ({ ...s, downloadProgress: progress }));
        },
      );

      clearInterval(progressInterval);

      if (!result.success) {
        setState((s) => ({
          ...s,
          isDownloading: false,
          downloadProgress: 0,
          error: result.error.message,
        }));
        return;
      }

      const filePath = result.data;

      const verifyResult = await modelManager.verifyModel(filePath);
      if (!verifyResult.success) {
        setState((s) => ({
          ...s,
          isDownloading: false,
          downloadProgress: 0,
          error: verifyResult.error.message,
        }));
        return;
      }

      // Mark as downloaded and save full ModelConfiguration
      modelRepository.markModelAsDownloaded(model.key);

      const modelConfig: ModelConfiguration = {
        id: `${model.key}:${Date.now()}`,
        displayName: model.name,
        modelKey: model.key,
        filePath,
        fileSizeBytes: model.fileSizeBytes,
        estimatedRamBytes: model.estimatedRamBytes,
        downloadStatus: "completed",
        downloadProgress: 100,
        isLoaded: false,
        lastUsedAt: null,
        customFolderUri: null,
      };
      modelRepository.saveActiveModel(modelConfig);

      setState((s) => ({
        ...s,
        isDownloading: false,
        downloadProgress: 100,
        downloadComplete: true,
        compatibleModels: s.compatibleModels.map((m) =>
          m.key === model.key ? { ...m, isDownloaded: true } : m,
        ),
      }));
    } catch {
      clearInterval(progressInterval);
      setState((s) => ({
        ...s,
        isDownloading: false,
        downloadProgress: 0,
        error: "Erro inesperado durante o download. Tente novamente.",
      }));
    }
  }, [state.selectedModel, state.isDownloading]);

  const cancelDownload = useCallback(async () => {
    await modelManager.cancelDownload();
    setState((s) => ({
      ...s,
      isDownloading: false,
      downloadProgress: 0,
      error: "Download cancelado pelo usuario.",
    }));
  }, []);

  const retryDownload = useCallback(async () => {
    setState((s) => ({ ...s, error: null, downloadProgress: 0 }));
    await startDownload();
  }, [startDownload]);

  const selectCustomFolder = useCallback(() => {
    setState((s) => ({
      ...s,
      error: "Selecao de pasta personalizada sera implementada em breve.",
    }));
  }, []);

  return {
    state,
    actions: {
      selectModel,
      startDownload,
      cancelDownload,
      retryDownload,
      selectCustomFolder,
      clearError,
    },
  };
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}
