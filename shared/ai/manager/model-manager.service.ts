import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import DeviceInfo from "react-native-device-info";
import { downloadFileAtomically, ensureDirectoryExists } from "./download";
import {
  ensureFileUri,
  extractFileNameFromUrl,
  getModelsDirectoryUri,
  resolveLegacyModelUri,
  resolveModelDestinationUri,
} from "./paths";
import {
  clearActiveModelId,
  getActiveModelId,
  getDownloadedModelMap,
  removeDownloadedModelKey,
  setActiveModelId,
  setDownloadedModelPath,
} from "./storage";
import { DownloadState, ResumableRef } from "./types";
import { fileExists, hasEnoughDiskSpace, verifyModelFile } from "./validation";

let modelManagerInstance: ModelManager | null = null;

export class ModelManager {
  private downloadState: DownloadState = {
    active: false,
    progress: 0,
    cancelled: false,
  };

  private resumableRef: ResumableRef = {
    current: null,
  };

  async downloadModel(
    modelId: string,
    url: string,
    path?: string,
    expectedSize?: number,
    onProgress?: (progress: number) => void,
  ): Promise<Result<string>> {
    this.downloadState = {
      active: true,
      progress: 0,
      cancelled: false,
    };

    try {
      const modelsDirectoryResult = getModelsDirectoryUri();
      if (!modelsDirectoryResult.success) {
        return err(modelsDirectoryResult.error);
      }

      const modelsDirectoryUri = modelsDirectoryResult.data;
      const ensureDirectoryResult = await ensureDirectoryExists(modelsDirectoryUri);
      if (!ensureDirectoryResult.success) {
        return err(ensureDirectoryResult.error);
      }

      const destinationUri = resolveModelDestinationUri(
        modelId,
        path,
        modelsDirectoryUri,
      );

      const downloadResult = await downloadFileAtomically({
        url,
        destinationUri,
        resumableRef: this.resumableRef,
        onProgress: (progress) => {
          this.downloadState.progress = progress;
          onProgress?.(progress);
        },
      });

      if (!downloadResult.success) {
        return err(downloadResult.error);
      }

      if (this.downloadState.cancelled) {
        return err(createError("UNKNOWN_ERROR", "Download cancelado pelo usuario."));
      }

      const verificationResult = await verifyModelFile(
        downloadResult.data.uri,
        expectedSize,
      );

      if (!verificationResult.success) {
        await this.deleteFileIfExists(downloadResult.data.uri);
        return err(verificationResult.error);
      }

      this.setDownloadedModel(modelId, downloadResult.data.uri);

      const legacyKey = extractFileNameFromUrl(url);
      if (legacyKey !== modelId) {
        removeDownloadedModelKey(legacyKey);
      }

      this.downloadState.progress = 100;
      onProgress?.(100);

      return ok(downloadResult.data.uri);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Falha ao baixar o modelo. Verifique sua conexao com a internet.",
          { modelId, url },
          error as Error,
        ),
      );
    } finally {
      const cancelled = this.downloadState.cancelled;
      this.downloadState.active = false;
      this.downloadState.cancelled = false;
      if (cancelled) {
        this.downloadState.progress = 0;
      }
    }
  }

  async verifyModel(
    filePath: string,
    expectedSize?: number,
  ): Promise<Result<boolean>> {
    const result = await verifyModelFile(filePath, expectedSize);
    if (!result.success) {
      return err(result.error);
    }

    return ok(true);
  }

  async loadModel(modelId: string, filePath: string): Promise<Result<void>> {
    try {
      const normalizedPath = ensureFileUri(filePath);
      const verifyResult = await verifyModelFile(normalizedPath);
      if (!verifyResult.success) {
        return err(verifyResult.error);
      }

      const runtime = getLocalAIRuntime();
      const result = await runtime.loadModel(modelId, normalizedPath);

      if (!result.success) {
        return err(result.error);
      }

      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Falha ao carregar o modelo na memoria.",
          { modelId, filePath },
          error as Error,
        ),
      );
    }
  }

  async unloadModel(): Promise<Result<void>> {
    try {
      const runtime = getLocalAIRuntime();
      const result = await runtime.unloadModel();

      if (!result.success) {
        return err(result.error);
      }

      this.clearActiveModel();
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

  setActiveModel(modelId: string): void {
    setActiveModelId(modelId);
  }

  clearActiveModel(): void {
    clearActiveModelId();
  }

  getActiveModel(): string | null {
    return getActiveModelId();
  }

  setDownloadedModel(modelId: string, localPath: string): void {
    setDownloadedModelPath(modelId, ensureFileUri(localPath));
  }

  getDownloadedModels(): Record<string, string> {
    return getDownloadedModelMap();
  }

  async getDownloadedModelPath(
    modelId: string,
    downloadUrl?: string,
  ): Promise<string | null> {
    const downloadedMap = getDownloadedModelMap();

    const persistedPath = downloadedMap[modelId];
    if (persistedPath) {
      const normalizedPersistedPath = ensureFileUri(persistedPath);
      if (await fileExists(normalizedPersistedPath)) {
        if (normalizedPersistedPath !== persistedPath) {
          this.setDownloadedModel(modelId, normalizedPersistedPath);
        }

        return normalizedPersistedPath;
      }

      removeDownloadedModelKey(modelId);
    }

    const modelsDirectoryResult = getModelsDirectoryUri();
    if (!modelsDirectoryResult.success) {
      return null;
    }

    const modelsDirectoryUri = modelsDirectoryResult.data;
    const defaultUri = resolveModelDestinationUri(
      modelId,
      undefined,
      modelsDirectoryUri,
    );
    if (await fileExists(defaultUri)) {
      this.setDownloadedModel(modelId, defaultUri);
      return defaultUri;
    }

    if (!downloadUrl) {
      return null;
    }

    const legacyKey = extractFileNameFromUrl(downloadUrl);
    const legacyPersistedPath = downloadedMap[legacyKey];
    if (legacyPersistedPath) {
      const normalizedLegacyPath = ensureFileUri(legacyPersistedPath);
      if (await fileExists(normalizedLegacyPath)) {
        this.setDownloadedModel(modelId, normalizedLegacyPath);
        if (legacyKey !== modelId) {
          removeDownloadedModelKey(legacyKey);
        }

        return normalizedLegacyPath;
      }

      removeDownloadedModelKey(legacyKey);
    }

    const legacyUriOnDisk = resolveLegacyModelUri(downloadUrl, modelsDirectoryUri);
    if (await fileExists(legacyUriOnDisk)) {
      this.setDownloadedModel(modelId, legacyUriOnDisk);
      if (legacyKey !== modelId) {
        removeDownloadedModelKey(legacyKey);
      }

      return legacyUriOnDisk;
    }

    return null;
  }

  async hasEnoughRam(estimatedRamBytes: number): Promise<Result<boolean>> {
    try {
      const totalRam = await DeviceInfo.getTotalMemory();
      if (totalRam < estimatedRamBytes) {
        return err(
          createError(
            "VALIDATION_ERROR",
            `RAM insuficiente: ${Math.round(totalRam / 1024 / 1024)}MB disponivel, ${Math.round(estimatedRamBytes / 1024 / 1024)}MB necessario.`,
            { availableRam: totalRam, requiredRam: estimatedRamBytes },
          ),
        );
      }

      return ok(true);
    } catch (error) {
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Nao foi possivel verificar a RAM do dispositivo.",
          {},
          error as Error,
        ),
      );
    }
  }

  async hasEnoughDisk(requiredBytes: number): Promise<Result<boolean>> {
    return hasEnoughDiskSpace(requiredBytes);
  }

  async cancelDownload(): Promise<void> {
    if (!this.downloadState.active) {
      return;
    }

    this.downloadState.cancelled = true;

    if (this.resumableRef.current) {
      try {
        await this.resumableRef.current.cancelAsync();
      } catch {
        return;
      }
    }
  }

  getDownloadProgress(): number {
    return this.downloadState.progress;
  }

  isDownloadActive(): boolean {
    return this.downloadState.active;
  }

  private async deleteFileIfExists(uri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  }
}

export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager();
  }

  return modelManagerInstance;
}
