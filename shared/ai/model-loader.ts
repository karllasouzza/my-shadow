import { setLastUsedModelId } from "@/database/actions/chat-actions";
import DeviceInfo from "react-native-device-info";
import { findModelById, getAllModels } from "./catalog";
import {
  getDownloadedModels,
  getModelLocalPath,
  isModelDownloaded,
} from "./manager";
import { getAIRuntime } from "./runtime";
import { AvailableModel, ModelLoadResult } from "./types/model-loader";

/**
 * Loads a model into memory.
 * Validates RAM, checks the local path, and delegates to the runtime.
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
 * Unloads the model from memory.
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
 * Returns available models for selection (downloaded).
 */
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

/** Returns the currently selected model ID */
export function getSelectedModelId(): string | null {
  return getAIRuntime().getCurrentModel()?.id ?? null;
}

/**
 * Try auto-loading last used model on app start
 * if available and not already loaded.
 * @returns {Promise<ModelLoadResult | null>} - Result of the auto-load attempt or null if not applicable.
 */
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
