import chatState$ from "@/database/chat";
import { getDownloadedModels, getModelLocalPath } from "./manager";
import { findModelById, getAllModels } from "./text-generation/catalog";
import { getAIRuntime } from "./text-generation/runtime";
import { AvailableModel, ModelLoadResult } from "./types/model-loader";

export async function loadModel(modelId: string): Promise<ModelLoadResult> {
  const model = findModelById(modelId);
  if (!model) return { success: false, error: "Modelo não encontrado" };

  const path = await getModelLocalPath(modelId);
  if (!path) return { success: false, error: "Modelo não baixado" };

  const runtime = getAIRuntime();

  const result = await runtime.loadModel(modelId, path, model.fileSizeBytes);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  // Save last loaded model
  chatState$.lastModelId.set(modelId);

  return { success: true };
}

export async function unloadModel(): Promise<ModelLoadResult> {
  const result = await getAIRuntime().unloadModel();

  if (result.success) {
    // Clear last model when unloading
    chatState$.lastModelId.set(null);
  }

  return result.success
    ? { success: true }
    : { success: false, error: result.error?.message };
}

export function getSelectedModelId(): string | null {
  return getAIRuntime().getCurrentModel()?.id ?? null;
}

export async function autoLoadLastModel(): Promise<ModelLoadResult> {
  const lastModelId = chatState$.lastModelId.get();

  if (!lastModelId) {
    return { success: false, error: "Nenhum modelo anterior encontrado" };
  }

  return loadModel(lastModelId);
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
