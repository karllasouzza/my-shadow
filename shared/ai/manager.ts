import { aiDebug, aiError, aiInfo } from "@/shared/ai/log";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { getAIRuntime } from "./text-generation/runtime";
import {
  DownloadedModelInfo,
  ModelType,
  OnDownloadProgress,
} from "./types/manager";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

// In-memory cache for downloaded models to avoid frequent disk reads.
// Cache is short-lived and updated on download/remove.
let downloadedModelsCache: {
  ts: number;
  map: Record<string, DownloadedModelInfo>;
} | null = null;
const CACHE_TTL_MS = 10000; // 10s

// Active download tasks tracked in-memory for concurrent download support.
interface DownloadTask {
  promise: Promise<Result<string>>;
  progress: number;
  abortController: AbortController;
  /** The underlying DownloadResumable, used for cancellation */
  resumable: FileSystem.DownloadResumable | null;
}

const activeDownloads = new Map<string, DownloadTask>();

export function invalidateDownloadedModelsCache() {
  downloadedModelsCache = null;
  aiDebug("STORAGE:cache:invalidate", "cache invalidated");
}

/** Clears all active downloads — for testing only. */
export function _clearActiveDownloadsForTesting() {
  activeDownloads.clear();
}

/** Returns the local URI for a model file based on its type. */
export function getModelUri(modelId: string, modelType: ModelType): string {
  const ext = modelType === "gguf" ? ".gguf" : ".bin";
  return `${MODELS_DIR}${modelId}${ext}`;
}

async function ensureModelsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

/**
 * Downloads a model using createDownloadResumable.
 * Concurrent calls for the same modelId return the existing promise.
 */
export async function downloadModelById(
  modelId: string,
  link: string,
  modelType: ModelType,
  onProgress?: OnDownloadProgress,
): Promise<Result<string>> {
  // Deduplication: return existing task if already downloading
  const existing = activeDownloads.get(modelId);
  if (existing) {
    aiDebug("DOWNLOAD:dedup", `returning existing task for modelId=${modelId}`);
    return existing.promise;
  }

  const abortController = new AbortController();
  const task: DownloadTask = {
    promise: null as unknown as Promise<Result<string>>,
    progress: 0,
    abortController,
    resumable: null,
  };

  const promise = _doDownload(modelId, link, modelType, onProgress, task);
  task.promise = promise;
  activeDownloads.set(modelId, task);

  return promise;
}

async function _doDownload(
  modelId: string,
  link: string,
  modelType: ModelType,
  onProgress: OnDownloadProgress | undefined,
  task: DownloadTask,
): Promise<Result<string>> {
  try {
    await ensureModelsDir();
    const start = Date.now();
    const destUri = getModelUri(modelId, modelType);
    const fileInfo = await FileSystem.getInfoAsync(destUri);

    if (fileInfo.exists) {
      aiDebug("DOWNLOAD:skip", `model already exists: ${modelId}`, { destUri });
      _updateCache(modelId, destUri, modelType);
      activeDownloads.delete(modelId);
      onProgress?.({ modelId, progress: 100 });
      return ok(destUri);
    }

    aiInfo("DOWNLOAD:start", `modelId=${modelId}`, { modelId, link });
    onProgress?.({ modelId, progress: 0 });
    task.progress = 0;

    const downloadResumable = FileSystem.createDownloadResumable(
      link,
      destUri,
      {},
      (progress) => {
        if (task.abortController.signal.aborted) return;
        const { totalBytesExpectedToWrite, totalBytesWritten } = progress;
        const percent =
          totalBytesExpectedToWrite > 0
            ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
            : 0;
        task.progress = percent;
        aiDebug("DOWNLOAD:progress", `modelId=${modelId} pct=${percent}`, {
          modelId,
          percent,
        });
        onProgress?.({ modelId, progress: percent });
      },
    );

    task.resumable = downloadResumable;

    // Check if already aborted before starting
    if (task.abortController.signal.aborted) {
      await _deletePartialFile(destUri);
      activeDownloads.delete(modelId);
      return err(
        createError("STORAGE_ERROR", "Download cancelado.", { modelId }),
      );
    }

    const result = await downloadResumable.downloadAsync();

    if (task.abortController.signal.aborted) {
      await _deletePartialFile(destUri);
      activeDownloads.delete(modelId);
      return err(
        createError("STORAGE_ERROR", "Download cancelado.", { modelId }),
      );
    }

    if (!result?.uri) {
      await _deletePartialFile(destUri);
      activeDownloads.delete(modelId);
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

    _updateCache(modelId, destUri, modelType);
    task.progress = 100;
    activeDownloads.delete(modelId);
    onProgress?.({ modelId, progress: 100 });
    return ok(destUri);
  } catch (error) {
    const destUri = getModelUri(modelId, modelType);
    await _deletePartialFile(destUri);
    activeDownloads.delete(modelId);
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

function _updateCache(
  modelId: string,
  localPath: string,
  modelType: ModelType,
) {
  downloadedModelsCache = downloadedModelsCache ?? { ts: Date.now(), map: {} };
  downloadedModelsCache.map[modelId] = { modelId, localPath, modelType };
  downloadedModelsCache.ts = Date.now();
}

async function _deletePartialFile(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // best-effort cleanup
  }
}

/**
 * Cancels an in-flight download, deletes any partial file, and removes the task.
 */
export async function cancelDownload(modelId: string): Promise<void> {
  const task = activeDownloads.get(modelId);
  if (!task) return;

  task.abortController.abort();

  // Pause the resumable to stop network activity
  try {
    await task.resumable?.pauseAsync();
  } catch {
    // ignore
  }

  // Determine the partial file URI — we need to find it from the cache or scan
  // Since we don't know modelType here, try both extensions
  for (const ext of [".gguf", ".bin"] as const) {
    const uri = `${MODELS_DIR}${modelId}${ext}`;
    await _deletePartialFile(uri);
  }

  activeDownloads.delete(modelId);
  aiInfo("DOWNLOAD:cancel", `modelId=${modelId} cancelled`);
}

/**
 * Returns the current download progress (0–100) for an active download, or null.
 */
export function getDownloadProgress(modelId: string): number | null {
  const task = activeDownloads.get(modelId);
  return task ? task.progress : null;
}

/**
 * Lists all downloaded models (both .gguf and .bin).
 */
export async function getDownloadedModels(): Promise<
  Record<string, DownloadedModelInfo>
> {
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
      (acc, name) => {
        if (name.endsWith(".gguf")) {
          const modelId = name.replace(/\.gguf$/, "");
          acc[modelId] = {
            modelId,
            localPath: MODELS_DIR + name,
            modelType: "gguf",
          };
        } else if (name.endsWith(".bin")) {
          const modelId = name.replace(/\.bin$/, "");
          acc[modelId] = {
            modelId,
            localPath: MODELS_DIR + name,
            modelType: "bin",
          };
        }
        return acc;
      },
      {} as Record<string, DownloadedModelInfo>,
    );

    downloadedModelsCache = { ts: Date.now(), map };
    aiDebug("STORAGE:list", `found=${Object.keys(map).length}`);
    return map;
  } catch {
    return {};
  }
}

/**
 * Checks if a model is downloaded (tries both .gguf and .bin).
 */
export async function isModelDownloaded(modelId: string): Promise<boolean> {
  for (const ext of [".gguf", ".bin"] as const) {
    const info = await FileSystem.getInfoAsync(`${MODELS_DIR}${modelId}${ext}`);
    if (info.exists) return true;
  }
  return false;
}

/**
 * Returns local path or null (checks both .gguf and .bin).
 */
export async function getModelLocalPath(
  modelId: string,
): Promise<string | null> {
  // Try cache first
  if (
    downloadedModelsCache &&
    Date.now() - downloadedModelsCache.ts < CACHE_TTL_MS
  ) {
    const entry = downloadedModelsCache.map[modelId];
    if (entry) {
      const info = await FileSystem.getInfoAsync(entry.localPath);
      if (info.exists) return entry.localPath;
      // stale cache entry
      delete downloadedModelsCache.map[modelId];
      downloadedModelsCache.ts = Date.now();
    }
  }

  for (const ext of [".gguf", ".bin"] as const) {
    const uri = `${MODELS_DIR}${modelId}${ext}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
  }
  return null;
}

/**
 * Removes a downloaded model, unloading from both runtimes if needed.
 */
export async function removeDownloadedModel(
  modelId: string,
): Promise<Result<void>> {
  try {
    aiInfo("REMOVE:start", `modelId=${modelId}`);

    // Unload from LLM runtime if loaded
    const runtime = getAIRuntime();
    if (runtime.getCurrentModel()?.id === modelId) {
      aiDebug(
        "REMOVE:unload",
        `model is loaded in LLM runtime, unloading: ${modelId}`,
      );
      await runtime.unloadModel();
    }

    // TODO: Unload from Whisper runtime when stt/runtime.ts is available.
    // Guard with try/catch since the module may not exist yet.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sttRuntime = require("./stt/runtime") as {
        getWhisperRuntime: () => {
          isModelLoaded: (id?: string) => boolean;
          unloadModel: () => Promise<unknown>;
        };
      };
      const whisperRuntime = sttRuntime.getWhisperRuntime();
      if (whisperRuntime.isModelLoaded(modelId)) {
        aiDebug(
          "REMOVE:unload",
          `model is loaded in Whisper runtime, unloading: ${modelId}`,
        );
        await whisperRuntime.unloadModel();
      }
    } catch {
      // stt/runtime not yet available — skip
    }

    // Try to find and delete the file (both extensions)
    let deleted = false;
    for (const ext of [".gguf", ".bin"] as const) {
      const uri = `${MODELS_DIR}${modelId}${ext}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri);
        aiInfo("REMOVE:done", `modelId=${modelId} removed`, { uri });
        deleted = true;
        // update cache
        if (downloadedModelsCache?.map[modelId]) {
          delete downloadedModelsCache.map[modelId];
          downloadedModelsCache.ts = Date.now();
          aiDebug("STORAGE:cache:update", `removed ${modelId}`);
        }
        break;
      }
    }

    if (!deleted) {
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
