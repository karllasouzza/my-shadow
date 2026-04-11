/**
 * Models Store & View-Model
 *
 * Padrão synced() com persistência automática via MMKV.
 * Usa @react-native-ai/llama para download e carregamento.
 */

import {
    findModelById,
    getAIRuntime,
    getAllModels,
    getModelManager,
    type ModelCatalogEntry,
} from "@/shared/ai";
import { observable } from "@legendapp/state";
import { ObservablePersistMMKV } from "@legendapp/state/persist-plugins/mmkv";
import { synced } from "@legendapp/state/sync";
import DeviceInfo from "react-native-device-info";

// ============================================================================
// Tipos
// ============================================================================

export interface DownloadedModelInfo {
  id: string;
  localPath: string | null;
  isLoaded: boolean;
}

interface ModelsState {
  catalog: ModelCatalogEntry[];
  activeModelId: string | null;
  isLoading: boolean;
  downloadingModelId: string | null;
  downloadProgress: number;
  errorMessage: string | null;
  ramWarning: {
    modelId: string;
    requiredMB: number;
    availableMB: number;
  } | null;
}

const INITIAL_STATE: ModelsState = {
  catalog: getAllModels(),
  activeModelId: null,
  isLoading: false,
  downloadingModelId: null,
  downloadProgress: 0,
  errorMessage: null,
  ramWarning: null,
};

// ============================================================================
// Store com synced() — persistência automática
// ============================================================================

export const modelsStore$ = observable(
  synced<ModelsState>({
    initial: INITIAL_STATE,
    persist: {
      name: "models_state",
      plugin: new ObservablePersistMMKV({ id: "myAppStorage" }),
    },
  }),
);

// ============================================================================
// Actions
// ============================================================================

/** Busca modelos disponíveis no catálogo */
export function browseModels(): void {
  modelsStore$.catalog.set(getAllModels());
}

/** Download de modelo com progresso */
export async function downloadModel(modelId: string): Promise<void> {
  const model = findModelById(modelId);
  if (!model) {
    modelsStore$.errorMessage.set("Modelo não encontrado no catálogo.");
    return;
  }

  modelsStore$.isLoading.set(true);
  modelsStore$.downloadingModelId.set(modelId);
  modelsStore$.downloadProgress.set(0);
  modelsStore$.errorMessage.set(null);

  try {
    // Validação de espaço em disco
    const freeDisk = await DeviceInfo.getFreeDiskStorage("important");
    if (freeDisk < model.fileSizeBytes) {
      modelsStore$.errorMessage.set("Espaço em disco insuficiente.");
      modelsStore$.isLoading.set(false);
      modelsStore$.downloadingModelId.set(null);
      return;
    }

    // @react-native-ai/llama: download retorna caminho local
    const { downloadModel: downloadModelFromHF } =
      await import("@react-native-ai/llama");
    const localPath = await downloadModelFromHF(model.huggingFaceId);

    // Persiste caminho do modelo baixado
    const manager = getModelManager();
    manager.setDownloadedModelPath(modelId, localPath);

    modelsStore$.downloadProgress.set(100);
    modelsStore$.isLoading.set(false);
    modelsStore$.downloadingModelId.set(null);

    await refreshStatus();
  } catch (error: any) {
    modelsStore$.isLoading.set(false);
    modelsStore$.downloadingModelId.set(null);
    modelsStore$.errorMessage.set(error?.message ?? "Falha ao baixar modelo.");
  }
}

/** Carrega modelo na memória */
export async function loadModel(
  modelId: string,
  onChatReady?: () => void,
): Promise<void> {
  const model = findModelById(modelId);
  if (!model) {
    modelsStore$.errorMessage.set("Modelo não encontrado no catálogo.");
    return;
  }

  // Validação de RAM
  const totalRam = await DeviceInfo.getTotalMemory();
  if (totalRam < model.estimatedRamBytes) {
    modelsStore$.ramWarning.set({
      modelId,
      requiredMB: Math.round(model.estimatedRamBytes / 1024 / 1024),
      availableMB: Math.round(totalRam / 1024 / 1024),
    });
    modelsStore$.errorMessage.set(
      `RAM insuficiente: ${Math.round(totalRam / 1024 / 1024)}MB disponível, ${Math.round(model.estimatedRamBytes / 1024 / 1024)}MB necessário.`,
    );
    return;
  }

  modelsStore$.ramWarning.set(null);
  modelsStore$.isLoading.set(true);
  modelsStore$.errorMessage.set(null);

  const runtime = getAIRuntime();
  const manager = getModelManager();
  const localPath = manager.getModelLocalPath(modelId);

  if (!localPath) {
    modelsStore$.isLoading.set(false);
    modelsStore$.errorMessage.set(
      "Arquivo do modelo não encontrado no disco. Baixe o modelo novamente.",
    );
    return;
  }

  const loadResult = await runtime.loadModel(modelId, localPath);

  modelsStore$.isLoading.set(false);

  if (!loadResult.success) {
    modelsStore$.errorMessage.set(loadResult.error.message);
    return;
  }

  modelsStore$.activeModelId.set(modelId);

  if (onChatReady) onChatReady();
  refreshStatus();
}

/** Descarrega modelo da memória */
export async function unloadModel(): Promise<void> {
  const runtime = getAIRuntime();
  modelsStore$.isLoading.set(true);
  const result = await runtime.unloadModel();
  modelsStore$.isLoading.set(false);

  if (!result.success) {
    modelsStore$.errorMessage.set(result.error.message);
    return;
  }

  refreshStatus();
}

/** Atualiza status de modelos baixados/carregados */
export async function refreshStatus(): Promise<void> {
  const runtime = getAIRuntime();
  const manager = getModelManager();
  const currentModel = runtime.getCurrentModel();
  const downloadedPaths = manager.getDownloadedModels();

  const activeModelId = currentModel?.id ?? null;
  modelsStore$.activeModelId.set(activeModelId);

  const catalog = getAllModels();
  const downloaded = catalog.map((m) => ({
    id: m.id,
    localPath: downloadedPaths[m.id] ?? null,
    isLoaded: m.id === currentModel?.id,
  }));

  // Persiste info de downloads
  catalog.forEach((m) => {
    const info = downloaded.find((d) => d.id === m.id);
    if (info?.localPath) {
      manager.setDownloadedModelPath(m.id, info.localPath);
    }
  });
}

// ============================================================================
// Helpers para acesso rápido
// ============================================================================

export function getCatalog() {
  return modelsStore$.catalog.get();
}

export function getActiveModelId() {
  return modelsStore$.activeModelId.get();
}

export function getIsLoading() {
  return modelsStore$.isLoading.get();
}

export function getDownloadingModelId() {
  return modelsStore$.downloadingModelId.get();
}

export function getDownloadProgress() {
  return modelsStore$.downloadProgress.get();
}

export function getErrorMessage() {
  return modelsStore$.errorMessage.get();
}

export function getRamWarning() {
  return modelsStore$.ramWarning.get();
}
