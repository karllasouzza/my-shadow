import chatState$ from "@/database/chat";
import { aiError, aiInfo } from "@/shared/ai/log";
import { getDownloadedModels, getModelLocalPath } from "./manager";
import { WHISPER_CATALOG, findWhisperModelById } from "./stt/catalog";
import { getWhisperRuntime } from "./stt/runtime";
import { findModelById, getAllModels } from "./text-generation/catalog";
import { getAIRuntime } from "./text-generation/runtime";
import { ModelType } from "./types/manager";
import { AvailableModel, ModelLoadResult } from "./types/model-loader";

export async function loadModel(modelId: string): Promise<ModelLoadResult> {
  const llmModel = findModelById(modelId);
  const whisperModel = findWhisperModelById(modelId);
  const model = llmModel || whisperModel;

  if (!model) return { success: false, error: "Modelo não encontrado" };

  const path = await getModelLocalPath(modelId);
  if (!path) return { success: false, error: "Modelo não baixado" };

  aiInfo(
    "MODEL:load:start",
    `modelId=${modelId} modelType=${model.modelType}`,
    { modelId, path, modelType: model.modelType },
  );
  const start = Date.now();

  // Dispatch to correct runtime based on modelType
  let result;
  if (model.modelType === "gguf") {
    const runtime = getAIRuntime();
    result = await runtime.loadModel(modelId, path, model.fileSizeBytes);
  } else if (model.modelType === "bin") {
    const runtime = getWhisperRuntime();
    result = await runtime.loadModel(modelId, path);
  } else {
    return { success: false, error: "Tipo de modelo não suportado" };
  }

  if (!result.success) {
    aiError(
      "MODEL:load:error",
      `modelId=${modelId} msg=${result.error.message}`,
      { error: result.error },
    );
    return { success: false, error: result.error.message };
  }

  const duration = Date.now() - start;
  aiInfo("MODEL:load:done", `modelId=${modelId} duration_ms=${duration}`, {
    modelId,
    duration,
  });

  // Persist to correct chatState field based on modelType
  if (model.modelType === "gguf") {
    chatState$.lastModelId.set(modelId);
  } else if (model.modelType === "bin") {
    chatState$.lastWhisperModelId.set(modelId);
  }

  return { success: true };
}

export async function unloadModel(modelId: string): Promise<ModelLoadResult> {
  // Look up modelId in unified catalog to determine type
  const llmModel = findModelById(modelId);
  const whisperModel = findWhisperModelById(modelId);
  const model = llmModel || whisperModel;

  if (!model) return { success: false, error: "Modelo não encontrado" };

  aiInfo(
    "MODEL:unload:start",
    `modelId=${modelId} modelType=${model.modelType}`,
    { modelId, modelType: model.modelType },
  );
  const start = Date.now();

  // Dispatch to correct runtime based on modelType
  let result;
  if (model.modelType === "gguf") {
    result = await getAIRuntime().unloadModel();
  } else if (model.modelType === "bin") {
    result = await getWhisperRuntime().unloadModel();
  } else {
    return { success: false, error: "Tipo de modelo não suportado" };
  }

  if (result.success) {
    // Clear the correct chatState field based on model type
    if (model.modelType === "gguf") {
      chatState$.lastModelId.set(null);
    } else if (model.modelType === "bin") {
      chatState$.lastWhisperModelId.set(null);
    }

    const duration = Date.now() - start;
    aiInfo("MODEL:unload:done", `modelId=${modelId} duration_ms=${duration}`, {
      modelId,
      duration,
    });
    return { success: true };
  }

  aiError(
    "MODEL:unload:error",
    `modelId=${modelId} msg=${result.error?.message}`,
    { error: result.error },
  );
  return { success: false, error: result.error?.message };
}

export function getSelectedModelId(modelType: ModelType): string | null {
  if (modelType === "gguf") {
    return getAIRuntime().getCurrentModel()?.id ?? null;
  } else if (modelType === "bin") {
    return getWhisperRuntime().getCurrentModel()?.id ?? null;
  }
  return null;
}

export async function autoLoadLastModel(
  modelType: ModelType,
): Promise<ModelLoadResult> {
  // Read from correct chatState field based on modelType
  const lastModelId =
    modelType === "gguf"
      ? chatState$.lastModelId.get()
      : chatState$.lastWhisperModelId.get();

  if (!lastModelId) {
    return { success: false, error: "Nenhum modelo anterior encontrado" };
  }
  aiInfo("MODEL:autoload", `modelId=${lastModelId} modelType=${modelType}`);
  return loadModel(lastModelId);
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  // Merge LLM and Whisper catalogs
  const llmCatalog = getAllModels();
  const whisperCatalog = WHISPER_CATALOG;
  const downloaded = await getDownloadedModels();

  // Get loaded model IDs from both runtimes
  const loadedLlmId = getAIRuntime().getCurrentModel()?.id;
  const loadedWhisperId = getWhisperRuntime().getCurrentModel()?.id;

  return Object.keys(downloaded)
    .map((id) => {
      // Check both catalogs for model metadata
      const llmMeta = llmCatalog.find((m) => m.id === id);
      const whisperMeta = whisperCatalog.find((m) => m.id === id);
      const meta = llmMeta || whisperMeta;

      // Determine if loaded based on modelType
      const modelType = meta?.modelType ?? ("gguf" as const);
      const isLoaded =
        modelType === "gguf" ? id === loadedLlmId : id === loadedWhisperId;

      return {
        id,
        displayName: meta?.displayName ?? id,
        bytes: llmMeta?.bytes ?? "N/A",
        isLoaded,
        supportsReasoning: llmMeta?.supportsReasoning ?? false,
        modelType,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
