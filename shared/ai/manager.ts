import { aiDebug, aiError, aiInfo } from "@/shared/ai/log";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { getAIRuntime } from "./text-generation/runtime";
import { OnDownloadProgress } from "./types/manager";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

// In-memory cache for downloaded models to avoid frequent disk reads.
// Cache is short-lived and updated on download/remove.
let downloadedModelsCache: { ts: number; map: Record<string, string> } | null =
  null;
const CACHE_TTL_MS = 5000; // 5s

export function invalidateDownloadedModelsCache() {
  downloadedModelsCache = null;
  aiDebug("STORAGE:cache:invalidate", "cache invalidated");
}

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
    const start = Date.now();
    const destUri = getModelUri(modelId);
    const fileInfo = await FileSystem.getInfoAsync(destUri);

    if (fileInfo.exists) {
      aiDebug("DOWNLOAD:skip", `model already exists: ${modelId}`, { destUri });
      // update cache
      downloadedModelsCache = downloadedModelsCache ?? {
        ts: Date.now(),
        map: {},
      };
      downloadedModelsCache.map[modelId] = destUri;
      downloadedModelsCache.ts = Date.now();
      return ok(destUri);
    }

    aiInfo("DOWNLOAD:start", `modelId=${modelId}`, { modelId, link });
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
        aiDebug("DOWNLOAD:progress", `modelId=${modelId} pct=${percent}`, {
          modelId,
          percent,
        });
        onProgress?.({ modelId, progress: percent });
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      aiError("DOWNLOAD:error", `modelId=${modelId} no-uri`);
      return err(
        createError("STORAGE_ERROR", "Falha ao baixar o modelo.", { modelId }),
      );
    }

    const duration = Date.now() - start;
    aiInfo(
      "DOWNLOAD:done",
      `modelId=${modelId} destUri=${result.uri} duration_ms=${duration}`,
      { modelId, destUri: result.uri, duration_ms: duration },
    );
    // update cache
    downloadedModelsCache = downloadedModelsCache ?? {
      ts: Date.now(),
      map: {},
    };
    downloadedModelsCache.map[modelId] = destUri;
    downloadedModelsCache.ts = Date.now();

    onProgress?.({ modelId, progress: 100 });
    return ok(destUri);
  } catch (error) {
    aiError(
      "DOWNLOAD:error",
      `modelId=${modelId} error=${(error as Error)?.message}`,
      { error: (error as Error)?.message },
    );
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
    // Return cache when fresh
    if (
      downloadedModelsCache &&
      Date.now() - downloadedModelsCache.ts < CACHE_TTL_MS
    ) {
      aiDebug(
        "STORAGE:cache:hit",
        `found=${Object.keys(downloadedModelsCache.map).length}`,
      );
      return downloadedModelsCache.map;
    }

    const info = await FileSystem.getInfoAsync(MODELS_DIR);
    if (!info.exists) {
      downloadedModelsCache = { ts: Date.now(), map: {} };
      return {};
    }

    const files = await FileSystem.readDirectoryAsync(MODELS_DIR);
    const map = files.reduce(
      (map, name) => {
        if (name.endsWith(".gguf")) {
          map[name.replace(/\.gguf$/, "")] = MODELS_DIR + name;
        }
        return map;
      },
      {} as Record<string, string>,
    );
    downloadedModelsCache = { ts: Date.now(), map };
    aiDebug("STORAGE:list", `found=${Object.keys(map).length}`);
    return map;
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
  // Try cache first
  if (
    downloadedModelsCache &&
    Date.now() - downloadedModelsCache.ts < CACHE_TTL_MS
  ) {
    const p = downloadedModelsCache.map[modelId];
    if (p) {
      const info = await FileSystem.getInfoAsync(p);
      if (info.exists) return p;
      // stale cache entry
      delete downloadedModelsCache.map[modelId];
      downloadedModelsCache.ts = Date.now();
    }
  }

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
    aiInfo("REMOVE:start", `modelId=${modelId}`);
    const runtime = getAIRuntime();
    if (runtime.getCurrentModel()?.id === modelId) {
      aiDebug("REMOVE:unload", `model is loaded, unloading: ${modelId}`);
      await runtime.unloadModel();
    }

    const uri = getModelUri(modelId);
    const info = await FileSystem.getInfoAsync(uri);

    if (info.exists) {
      await FileSystem.deleteAsync(uri);
      aiInfo("REMOVE:done", `modelId=${modelId} removed`, { uri });
      // update cache
      if (downloadedModelsCache?.map[modelId]) {
        delete downloadedModelsCache.map[modelId];
        downloadedModelsCache.ts = Date.now();
        aiDebug("STORAGE:cache:update", `removed ${modelId}`);
      }
    } else {
      aiDebug("REMOVE:skip", `model not found: ${modelId}`);
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
