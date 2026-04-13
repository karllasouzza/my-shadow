import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { Directory, File, Paths } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { OnDownloadProgress } from "./types/manager";

const MODELS_DIR = new Directory(Paths.document, "models");

/**
 * Ensures the models directory exists.
 */
function ensureModelsDir(): void {
  if (!MODELS_DIR.exists) {
    MODELS_DIR.create({ intermediates: true, idempotent: true });
  }
}

/**
 * Returns the destination File for a given model ID.
 */
function modelFileInstance(modelId: string): File {
  return new File(MODELS_DIR, `${modelId}.gguf`);
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
    ensureModelsDir();

    const dest = modelFileInstance(modelId);

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
        onProgress?.({
          modelId,
          progress: Math.round(
            (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) *
              100,
          ),
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
 * Returns a map of downloaded models: { modelId: filePath }.
 * Lists files in the models directory and filters by the .gguf extension.
 */
export function getDownloadedModels(): Record<string, string> {
  if (!MODELS_DIR.exists) return {};

  const map: Record<string, string> = {};
  const items = MODELS_DIR.list();

  for (const item of items) {
    if (item instanceof File && item.name.endsWith(".gguf")) {
      const modelId = item.name.replace(/\.gguf$/, "");
      map[modelId] = item.uri;
    }
  }

  return map;
}

/**
 * Checks whether a model is present on the device.
 */
export function isModelDownloaded(modelId: string): boolean {
  return modelFileInstance(modelId).exists;
}

/**
 * Returns the local path of the model, or null if it does not exist.
 */
export function getModelLocalPath(modelId: string): string | null {
  const file = modelFileInstance(modelId);
  return file.exists ? file.uri : null;
}

/**
 * Removes a downloaded model from the device (deletes the .gguf file).
 */
export function removeDownloadedModel(modelId: string): void {
  const file = modelFileInstance(modelId);
  if (file.exists) {
    file.delete();
  }
}
