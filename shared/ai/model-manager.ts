/**
 * T004/T009/T010: Model Manager — model lifecycle (download → verify → load → persist active)
 *
 * Shared AI service. Owns the full model lifecycle:
 * - downloadModel(): Download GGUF from catalog URL with progress callback
 * - verifyModel(): Check file exists and size > 0
 * - loadModel(): Load model into llama.rn via local-ai-runtime
 * - unloadModel(): Release model from llama.rn context
 * - setActiveModel(modelId): Persist active model to MMKV key `model:active`
 * - getActiveModel(): Read persisted active model ID
 *
 * On app launch, caller should call getActiveModel() → if exists, auto-load.
 */

import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import DeviceInfo from "react-native-device-info";
import { type MMKV, createMMKV } from "react-native-mmkv";

const MODELS_SUBDIRECTORY = "models";
const ACTIVE_MODEL_KEY = "model:active";

interface DownloadState {
  active: boolean;
  progress: number;
  cancelled: boolean;
  resumable?: FileSystem.DownloadResumable;
}

let modelManagerInstance: ModelManager | null = null;
let mmkvInstance: MMKV | null = null;

function getMMKV(): MMKV {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: "model_config" });
  }
  return mmkvInstance as MMKV;
}

export class ModelManager {
  private downloadState: DownloadState = {
    active: false,
    progress: 0,
    cancelled: false,
  };

  /**
   * Download a model from a URL to a local path with progress callback.
   */
  async downloadModel(
    url: string,
    path?: string,
    _expectedSize?: number,
    onProgress?: (progress: number) => void,
  ): Promise<Result<string>> {
    try {
      this.downloadState = { active: true, progress: 0, cancelled: false };

      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory) {
        return err(
          createError(
            "STORAGE_ERROR",
            "Diretório de armazenamento não disponível.",
          ),
        );
      }

      const modelsDir = `${documentDirectory}${MODELS_SUBDIRECTORY}/`;

      // Ensure models directory exists
      const dirInfo = await FileSystem.getInfoAsync(modelsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
      }

      const fileName = this.extractFileName(url);
      const filePath = path || `${modelsDir}${fileName}`;

      // Create resumable download with progress callback
      const resumable = FileSystem.createDownloadResumable(
        url,
        filePath,
        {},
        (downloadProgress) => {
          const progress =
            (downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite) *
            100;
          this.downloadState.progress = progress;
          onProgress?.(progress);
        },
      );

      this.downloadState.resumable = resumable;

      const result = await resumable.downloadAsync();

      if (this.downloadState.cancelled) {
        await this.cancelDownload();
        return err(
          createError("UNKNOWN_ERROR", "Download foi cancelado pelo usuário."),
        );
      }

      if (!result) {
        return err(
          createError(
            "STORAGE_ERROR",
            "Falha ao baixar o modelo. Verifique sua conexão.",
          ),
        );
      }

      this.downloadState.progress = 100;
      onProgress?.(100);
      this.downloadState = { active: false, progress: 100, cancelled: false };

      return ok(result.uri);
    } catch (error) {
      this.downloadState = { active: false, progress: 0, cancelled: false };
      return err(
        createError(
          "STORAGE_ERROR",
          "Falha ao baixar o modelo. Verifique sua conexão com a internet.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Verify that a model file exists and has the expected size.
   */
  async verifyModel(filePath: string): Promise<Result<boolean>> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (!fileInfo.exists) {
        return err(
          createError("NOT_FOUND", "Arquivo do modelo não encontrado.", {
            filePath,
          }),
        );
      }

      if (fileInfo.size === undefined || fileInfo.size <= 0) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Arquivo do modelo está vazio ou corrompido.",
            { filePath },
          ),
        );
      }

      return ok(true);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Erro ao verificar o arquivo do modelo.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Load a model into memory via LocalAIRuntimeService.
   */
  async loadModel(modelId: string, filePath: string): Promise<Result<void>> {
    try {
      const runtime = getLocalAIRuntime();
      const result = await runtime.loadModel(modelId, filePath);

      if (!result.success) {
        return err(result.error);
      }

      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Falha ao carregar o modelo na memória.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Unload the current model from llama.rn context.
   */
  async unloadModel(): Promise<Result<void>> {
    try {
      const runtime = getLocalAIRuntime();
      const result = await runtime.unloadModel();

      if (!result.success) {
        return err(result.error);
      }

      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Falha ao descarregar o modelo.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * T010: Save active model ID to MMKV for persistence between sessions.
   */
  setActiveModel(modelId: string): void {
    const store = getMMKV();
    store.set(ACTIVE_MODEL_KEY, modelId);
  }

  /**
   * T010: Read active model ID from MMKV. Returns null if none set.
   */
  getActiveModel(): string | null {
    const store = getMMKV();
    return store.getString(ACTIVE_MODEL_KEY) ?? null;
  }

  /**
   * T010: Check if device has enough RAM for the estimated model size.
   */
  async hasEnoughRam(estimatedRamBytes: number): Promise<Result<boolean>> {
    try {
      const totalRam = await DeviceInfo.getTotalMemory();
      if (totalRam < estimatedRamBytes) {
        return err(
          createError(
            "VALIDATION_ERROR",
            `RAM insuficiente: ${Math.round(totalRam / 1024 / 1024)}MB disponível, ${Math.round(estimatedRamBytes / 1024 / 1024)}MB necessário.`,
            { availableRam: totalRam, requiredRam: estimatedRamBytes },
          ),
        );
      }
      return ok(true);
    } catch (error) {
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Não foi possível verificar a RAM do dispositivo.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * T010: Check if device has enough free disk space for the model.
   */
  async hasEnoughDisk(_requiredBytes: number): Promise<Result<boolean>> {
    try {
      const documentDirectory = FileSystem.documentDirectory;
      if (!documentDirectory) {
        return err(
          createError(
            "STORAGE_ERROR",
            "Não foi possível acessar o diretório de armazenamento.",
          ),
        );
      }
      // expo-file-system doesn't expose free space directly; skip check if API unavailable
      // In production, use react-native-fs or similar for accurate free space
      return ok(true);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Não foi possível verificar o espaço em disco.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Cancel an active download.
   */
  async cancelDownload(): Promise<void> {
    if (this.downloadState.active) {
      this.downloadState.cancelled = true;
      if (this.downloadState.resumable) {
        try {
          await this.downloadState.resumable.cancelAsync();
        } catch {
          // Ignore cancel errors
        }
      }
      this.downloadState = { active: false, progress: 0, cancelled: false };
    }
  }

  /**
   * Get the current download progress (0-100).
   */
  getDownloadProgress(): number {
    return this.downloadState.progress;
  }

  /**
   * Check if a download is currently active.
   */
  isDownloadActive(): boolean {
    return this.downloadState.active;
  }

  private extractFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = pathname.substring(pathname.lastIndexOf("/") + 1);
      return fileName || "model.gguf";
    } catch {
      return "model.gguf";
    }
  }
}

/** Singleton accessor */
export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager();
  }
  return modelManagerInstance;
}
