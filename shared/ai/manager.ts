import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { getAIRuntime } from "./text-generation/runtime";
import { OnDownloadProgress } from "./types/manager";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

function getModelUri(modelId: string): string {
  return `${MODELS_DIR}${modelId}.gguf`;
}

async function ensureModelsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

/**
 * Downloads a model using createDownloadResumable.
 */
export async function downloadModelById(
  modelId: string,
  link: string,
  onProgress?: OnDownloadProgress,
): Promise<Result<string>> {
  try {
    await ensureModelsDir();

    const destUri = getModelUri(modelId);
    const fileInfo = await FileSystem.getInfoAsync(destUri);

    if (fileInfo.exists) {
      return ok(destUri);
    }

    onProgress?.({ modelId, progress: 0 });

    const downloadResumable = FileSystem.createDownloadResumable(
      link,
      destUri,
      {},
      (progress) => {
        const { totalBytesExpectedToWrite, totalBytesWritten } = progress;
        const percent =
          totalBytesExpectedToWrite > 0
            ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
            : 0;
        onProgress?.({ modelId, progress: percent });
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      return err(
        createError("STORAGE_ERROR", "Falha ao baixar o modelo.", { modelId }),
      );
    }

    onProgress?.({ modelId, progress: 100 });
    return ok(destUri);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao baixar o modelo. Verifique sua conexão.",
        { modelId, link },
        error as Error,
      ),
    );
  }
}

/**
 * Lists downloaded models.
 */
export async function getDownloadedModels(): Promise<Record<string, string>> {
  try {
    const info = await FileSystem.getInfoAsync(MODELS_DIR);
    if (!info.exists) return {};

    const files = await FileSystem.readDirectoryAsync(MODELS_DIR);

    return files.reduce(
      (map, name) => {
        if (name.endsWith(".gguf")) {
          map[name.replace(/\.gguf$/, "")] = MODELS_DIR + name;
        }
        return map;
      },
      {} as Record<string, string>,
    );
  } catch {
    return {};
  }
}

/**
 * Checks if a model is downloaded.
 */
export async function isModelDownloaded(modelId: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(getModelUri(modelId));
  return info.exists;
}

/**
 * Returns local path or null.
 */
export async function getModelLocalPath(
  modelId: string,
): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(getModelUri(modelId));
  return info.exists ? getModelUri(modelId) : null;
}

/**
 * Removes a downloaded model.
 */
export async function removeDownloadedModel(
  modelId: string,
): Promise<Result<void>> {
  try {
    const runtime = getAIRuntime();
    if (runtime.getCurrentModel()?.id === modelId) {
      await runtime.unloadModel();
    }

    const uri = getModelUri(modelId);
    const info = await FileSystem.getInfoAsync(uri);

    if (info.exists) {
      await FileSystem.deleteAsync(uri);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao remover modelo.",
        { modelId },
        error as Error,
      ),
    );
  }
}
