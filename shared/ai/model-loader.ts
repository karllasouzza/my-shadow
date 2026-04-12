/**
 * Model Loader
 *
 * Gerencia carregamento/descarregamento de modelos com validação.
 * Centralizado em shared/ai/ para reuso.
 */

import { setLastUsedModelId } from "@/database/actions/chat-actions";
import DeviceInfo from "react-native-device-info";
import { findModelById, getAllModels } from "./catalog";
import {
  getDownloadedModels,
  getModelLocalPath,
  isModelDownloaded,
} from "./manager";
import { getAIRuntime } from "./runtime";

export interface ModelLoadResult {
  success: boolean;
  error?: string;
}

/**
 * Carrega um modelo na memória.
 * Valida RAM, verifica path, delega para runtime.
 */
export async function loadModel(modelId: string): Promise<ModelLoadResult> {
  const model = findModelById(modelId);
  if (!model) {
    return { success: false, error: "Modelo não encontrado." };
  }

  // Check RAM
  const totalRam = await DeviceInfo.getTotalMemory();
  if (totalRam < model.estimatedRamBytes) {
    return {
      success: false,
      error: `RAM insuficiente: ${Math.round(totalRam / 1024 / 1024)}MB disponível, ${Math.round(model.estimatedRamBytes / 1024 / 1024)}MB necessário.`,
    };
  }

  const localPath = getModelLocalPath(modelId);
  if (!localPath) {
    return { success: false, error: "Arquivo do modelo não encontrado." };
  }

  const runtime = getAIRuntime();
  const result = await runtime.loadModel(modelId, localPath);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  // Persist last used
  setLastUsedModelId(modelId);

  return { success: true };
}

/**
 * Descarrega modelo da memória.
 */
export async function unloadModel(): Promise<ModelLoadResult> {
  const runtime = getAIRuntime();
  const result = await runtime.unloadModel();

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true };
}

/**
 * Retorna modelos disponíveis para seleção (baixados).
 */
export interface AvailableModel {
  id: string;
  displayName: string;
  isLoaded: boolean;
  supportsReasoning: boolean;
}

export function getAvailableModels(): AvailableModel[] {
  const downloaded = getDownloadedModels();
  const runtime = getAIRuntime();
  const loadedId = runtime.getCurrentModel()?.id;
  const catalog = getAllModels();

  return Object.keys(downloaded)
    .map((id) => {
      const entry = catalog.find((m: { id: string }) => m.id === id);
      return {
        id,
        displayName: entry?.displayName ?? id,
        isLoaded: id === loadedId,
        supportsReasoning: entry?.supportsReasoning ?? false,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Retorna modelo selecionado atual */
export function getSelectedModelId(): string | null {
  return getAIRuntime().getCurrentModel()?.id ?? null;
}

/** Carrega último modelo usado automaticamente */
export async function autoLoadLastModel(): Promise<ModelLoadResult | null> {
  const downloadedModels = Object.keys(getDownloadedModels());
  if (downloadedModels.length === 0) return null;

  const { getLastUsedModelId } =
    await import("@/database/actions/chat-actions");
  const lastModelId = getLastUsedModelId();
  if (!lastModelId) return null;

  if (!isModelDownloaded(lastModelId)) return null;

  const runtime = getAIRuntime();
  if (runtime.isModelLoaded()) return null;

  return loadModel(lastModelId);
}
