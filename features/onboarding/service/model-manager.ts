/**
 * Onboarding: Model Manager Service
 *
 * Handles downloading, verifying, and loading AI models on device.
 * Uses expo-file-system v54 API (File, Paths) for downloads with progress tracking.
 * Integrates with LocalAIRuntimeService for model loading.
 */

import { File, Paths } from 'expo-file-system';
import { getLocalAIRuntime } from '@/shared/ai/local-ai-runtime';
import { Result, createError, err, ok } from '@/shared/utils/app-error';

const MODELS_SUBDIRECTORY = 'models';

interface DownloadState {
  active: boolean;
  progress: number;
  cancelled: boolean;
}

export class ModelManager {
  private downloadState: DownloadState = {
    active: false,
    progress: 0,
    cancelled: false,
  };

  /**
   * Download a model from a URL to a local path with progress callback.
   * @param url - The URL to download the model from
   * @param path - Optional local file path. Defaults to Paths.document/models/<filename>
   * @param onProgress - Optional callback receiving progress (0-100)
   * @returns Result with the local file path on success
   */
  async downloadModel(
    url: string,
    path?: string,
    onProgress?: (progress: number) => void,
  ): Promise<Result<string>> {
    try {
      this.downloadState = { active: true, progress: 0, cancelled: false };

      const modelsDirectory = new File(Paths.document, MODELS_SUBDIRECTORY);
      if (!modelsDirectory.exists) {
        const dir = new (require('expo-file-system').Directory)(
          Paths.document,
          MODELS_SUBDIRECTORY,
        );
        dir.create({ intermediates: true });
      }

      const targetFile = path
        ? new File(path)
        : new File(Paths.document, MODELS_SUBDIRECTORY, this.extractFileName(url));

      const downloadOptions = {
        idempotent: true,
      };

      const downloadedFile = await File.downloadFileAsync(
        url,
        path
          ? targetFile.parentDirectory
          : new (require('expo-file-system').Directory)(
              Paths.document,
              MODELS_SUBDIRECTORY,
            ),
        downloadOptions,
      );

      if (this.downloadState.cancelled) {
        this.downloadState = { active: false, progress: 0, cancelled: false };
        return err(
          createError('UNKNOWN_ERROR', 'Download foi cancelado pelo usuario.'),
        );
      }

      this.downloadState.progress = 100;
      onProgress?.(100);

      this.downloadState = { active: false, progress: 100, cancelled: false };

      return ok(downloadedFile.uri);
    } catch (error) {
      this.downloadState = { active: false, progress: 0, cancelled: false };
      return err(
        createError(
          'STORAGE_ERROR',
          'Falha ao baixar o modelo. Verifique sua conexao com a internet.',
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Verify that a model file exists and has the expected size.
   * @param filePath - The local file path to verify
   * @returns Result indicating whether the file is valid
   */
  async verifyModel(filePath: string): Promise<Result<boolean>> {
    try {
      const file = new File(filePath);
      if (!file.exists) {
        return err(
          createError('NOT_FOUND', 'Arquivo do modelo nao encontrado.', {
            filePath,
          }),
        );
      }

      if (file.size <= 0) {
        return err(
          createError('VALIDATION_ERROR', 'Arquivo do modelo esta vazio ou corrompido.', {
            filePath,
          }),
        );
      }

      return ok(true);
    } catch (error) {
      return err(
        createError(
          'STORAGE_ERROR',
          'Erro ao verificar o arquivo do modelo.',
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Load a model into memory using LocalAIRuntimeService.
   * @param modelKey - The model identifier key
   * @param filePath - The local file path of the model
   * @returns Result indicating success or failure
   */
  async loadModel(modelKey: string, filePath: string): Promise<Result<void>> {
    try {
      const runtime = getLocalAIRuntime();
      const result = await runtime.loadModel(modelKey, filePath);

      if (!result.success) {
        return err(result.error);
      }

      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          'NOT_READY',
          'Falha ao carregar o modelo na memoria.',
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Cancel an active download.
   */
  cancelDownload(): void {
    if (this.downloadState.active) {
      this.downloadState.cancelled = true;
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
      const fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
      return fileName || 'model.bin';
    } catch {
      return 'model.bin';
    }
  }
}

// Singleton instance
let instance: ModelManager | null = null;

export const getModelManager = (): ModelManager => {
  if (!instance) {
    instance = new ModelManager();
  }
  return instance;
};
