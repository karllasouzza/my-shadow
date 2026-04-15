import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { Directory, File, Paths } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { getAIRuntime } from "./runtime";
import { OnDownloadProgress } from "./types/manager";

function getModelsDir(): Directory | null {
  const documentPath = Paths.document;
  if (!documentPath) {
    return null;
  }

  try {
    return new Directory(documentPath, "models");
  } catch (error) {
    console.error("Failed to create models directory handle", error);
    return null;
  }
}

/**
 * Ensures the models directory exists.
 */
function ensureModelsDir(): Directory | null {
  const modelsDir = getModelsDir();
  if (!modelsDir) {
    return null;
  }

  if (!modelsDir.exists) {
    modelsDir.create({ intermediates: true, idempotent: true });
  }

  return modelsDir;
}

/**
 * Returns the destination File for a given model ID.
 */
function modelFileInstance(modelId: string): File | null {
  const modelsDir = getModelsDir();
  if (!modelsDir) {
    return null;
  }

  return new File(modelsDir, `${modelId}.gguf`);
}

/**
 * Downloads a model using createDownloadResumable (expo-file-system/legacy).
 *
 * The file is saved at {MODELS_DIR}/{modelId}.gguf.
 * Supports an optional progress callback.
 *
 * @param modelId - Logical model ID in the catalog
 * @param link - Download URL or HuggingFace file identifier (e.g., "owner/repo/file.gguf")
 * @param onProgress - Progress callback invoked during download
 * @returns Result containing the local path to the GGUF file
 */
export async function downloadModelById(
  modelId: string,
  link: string,
  onProgress?: OnDownloadProgress,
): Promise<Result<string>> {
  try {
    const modelsDir = ensureModelsDir();
    if (!modelsDir) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Falha ao acessar diretório local de modelos.",
          { modelId },
        ),
      );
    }

    const dest = new File(modelsDir, `${modelId}.gguf`);

    if (dest.exists) {
      return ok(dest.uri);
    }

    const downloadUrl = link;

    onProgress?.({ modelId, progress: 0 });

    const downloadResumable = FileSystemLegacy.createDownloadResumable(
      downloadUrl,
      dest.uri,
      {},
      (progress) => {
        const totalBytes = progress.totalBytesExpectedToWrite;
        const rawProgress =
          totalBytes > 0
            ? (progress.totalBytesWritten / totalBytes) * 100
            : 0;

        onProgress?.({
          modelId,
          progress: Math.max(0, Math.min(100, Math.round(rawProgress))),
        });
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      return err(
        createError("STORAGE_ERROR", "Falha ao baixar o modelo.", { modelId }),
      );
    }

    onProgress?.({ modelId, progress: 100 });

    return ok(dest.uri);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao baixar o modelo. Verifique sua conexão com a internet.",
        { modelId, link },
        error as Error,
      ),
    );
  }
}

/**
 * Lists files in the models directory and filters by the .gguf extension.
 *
 * @returns {Record<string, string>} Map of model IDs to local file paths
 */
export function getDownloadedModels(): Record<string, string> {
  try {
    const modelsDir = getModelsDir();
    if (!modelsDir?.exists) return {};

    const map: Record<string, string> = {};
    const items = modelsDir.list();

    for (const item of items) {
      if (item instanceof File && item.name.endsWith(".gguf")) {
        const modelId = item.name.replace(/\.gguf$/, "");
        map[modelId] = item.uri;
      }
    }

    return map;
  } catch (error) {
    console.error("Failed to list downloaded models", error);
    return {};
  }
}

/**
 * Async version for screens/view-models to avoid sync filesystem reads in render paths.
 */
export async function getDownloadedModelsAsync(): Promise<Record<string, string>> {
  try {
    const modelsDir = getModelsDir();
    if (!modelsDir) return {};

    const info = await FileSystemLegacy.getInfoAsync(modelsDir.uri);
    if (!info.exists || !info.isDirectory) return {};

    const names = await FileSystemLegacy.readDirectoryAsync(modelsDir.uri);
    const map: Record<string, string> = {};
    for (const name of names) {
      if (!name.endsWith(".gguf")) continue;
      const modelId = name.replace(/\.gguf$/, "");
      map[modelId] = `${modelsDir.uri}/${name}`;
    }
    return map;
  } catch (error) {
    console.error("Failed to list downloaded models (async)", error);
    return {};
  }
}

/**
 * Checks whether a model is present on the device.
 */
export function isModelDownloaded(modelId: string): boolean {
  return modelFileInstance(modelId)?.exists ?? false;
}

/**
 * Returns the local path of the model, or null if it does not exist.
 */
export function getModelLocalPath(modelId: string): string | null {
  const file = modelFileInstance(modelId);
  if (!file) return null;
  return file.exists ? file.uri : null;
}

/**
 * Removes a downloaded model from the device (deletes the .gguf file).
 * If the model is currently loaded in the runtime, it will be unloaded first.
 *
 * @param modelId - Model ID to remove
 * @returns Result indicating success or failure
 */
export async function removeDownloadedModel(
  modelId: string,
): Promise<Result<void>> {
  try {
    const runtime = getAIRuntime();
    const loadedModel = runtime.getCurrentModel();

    // Unload from runtime first if this is the active model
    if (loadedModel?.id === modelId) {
      await runtime.unloadModel();
    }

    const file = modelFileInstance(modelId);
    if (!file?.exists) {
      return ok(undefined); // Already gone
    }

    file.delete();
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao remover modelo do dispositivo.",
        { modelId },
        error as Error,
      ),
    );
  }
}
