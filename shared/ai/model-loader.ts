import {
  getLastUsedModelId,
  setLastUsedModelId,
} from "@/database/actions/chat/last-model";
import DeviceInfo from "react-native-device-info";
import { findModelById, getAllModels } from "./catalog";
import {
  getDownloadedModels,
  getModelLocalPath,
  isModelDownloaded,
  removeDownloadedModel,
} from "./manager";
import { getAIRuntime } from "./runtime";
import type { AvailableModel, ModelLoadResult } from "./types/model-loader";

export { isModelDownloaded, removeDownloadedModel };

const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

export async function loadModel(modelId: string): Promise<ModelLoadResult> {
  const model = findModelById(modelId);
  if (!model) return { success: false, error: "Modelo não encontrado." };

  const path = await getModelLocalPath(modelId);
  if (!path) return { success: false, error: "Modelo não baixado." };

  const [total, used] = await Promise.all([
    DeviceInfo.getTotalMemory(),
    DeviceInfo.getUsedMemory(),
  ]);

  const free = total - used;
  if (free < model.estimatedRamBytes) {
    return {
      success: false,
      error: `RAM insuficiente: ${toMB(free)}MB livre, ${toMB(model.estimatedRamBytes)}MB necessário.`,
    };
  }

  const result = await getAIRuntime().loadModel(modelId, path);
  if (!result.success) return { success: false, error: result.error.message };

  await setLastUsedModelId(modelId);
  return { success: true };
}

export async function unloadModel(): Promise<ModelLoadResult> {
  const result = await getAIRuntime().unloadModel();
  return result.success
    ? { success: true }
    : { success: false, error: result.error.message };
}

export function getSelectedModelId(): string | null {
  return getAIRuntime().getCurrentModel()?.id ?? null;
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  const catalog = getAllModels();
  const downloaded = await getDownloadedModels();
  const loadedId = getAIRuntime().getCurrentModel()?.id;

  return Object.keys(downloaded)
    .map((id) => {
      const meta = catalog.find((m) => m.id === id);
      return {
        id,
        displayName: meta?.displayName ?? id,
        bytes: meta?.bytes ?? "0",
        isLoaded: id === loadedId,
        supportsReasoning: meta?.supportsReasoning ?? false,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function autoLoadLastModel(): Promise<ModelLoadResult | null> {
  const runtime = getAIRuntime();
  if (runtime.isModelLoaded()) return null;

  const lastId = getLastUsedModelId();
  if (!lastId || !(await isModelDownloaded(lastId))) return null;

  return loadModel(lastId);
}
