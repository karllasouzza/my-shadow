import { createError, err, ok, Result } from "@/shared/utils/app-error";

// Type-only import using the explicit subpath to avoid export resolution warnings
import type { WhisperContext } from "whisper.rn/src/index";

/**
 * WhisperRuntime singleton class for managing Whisper model lifecycle.
 *
 * Provides methods to load, unload, and query Whisper models for speech-to-text transcription.
 * Handles concurrent load requests by queueing them behind the active loading operation.
 *
 * Note: initWhisper is imported lazily inside performLoad() to avoid blocking app startup
 * if the native module fails to initialize.
 */
export class WhisperRuntime {
  private context: WhisperContext | null = null;
  private modelId: string | null = null;
  private loadingPromise: Promise<Result<{ id: string }>> | null = null;
  private initializationError: Error | null = null;

  isModelLoaded(id?: string): boolean {
    if (!this.context) return false;
    if (id && this.modelId !== id) return false;
    return true;
  }

  getCurrentModel(): { id: string; isLoaded: true } | null {
    if (!this.context || !this.modelId) return null;
    return { id: this.modelId, isLoaded: true };
  }

  async loadModel(
    modelId: string,
    path: string,
  ): Promise<Result<{ id: string }>> {
    // Queue concurrent calls behind existing load operation
    if (this.loadingPromise) {
      await this.loadingPromise;
    }

    // If model is already loaded with the same ID, return success
    if (this.context && this.modelId === modelId) {
      return ok({ id: modelId });
    }

    // Start new load operation
    this.loadingPromise = this.performLoad(modelId, path);
    const result = await this.loadingPromise;
    this.loadingPromise = null;

    return result;
  }

  private async performLoad(
    modelId: string,
    path: string,
  ): Promise<Result<{ id: string }>> {
    try {
      // Dynamically import initWhisper to defer native module initialization
      let initWhisper: typeof import("whisper.rn/src/index").initWhisper;
      try {
        const whisperModule = await import("whisper.rn/src/index");
        initWhisper = whisperModule.initWhisper;
      } catch (importError) {
        this.initializationError =
          importError instanceof Error
            ? importError
            : new Error(String(importError));
        return err(
          createError(
            "UNKNOWN_ERROR",
            "Whisper native module não pôde ser carregado. Verifique se o módulo está corretamente instalado.",
            { modelId, path },
            this.initializationError,
          ),
        );
      }

      // Unload any existing model first
      if (this.context) {
        await this.context.release();
        this.context = null;
        this.modelId = null;
      }

      // Initialize new Whisper context
      const context = await initWhisper({ filePath: path });

      this.context = context;
      this.modelId = modelId;

      return ok({ id: modelId });
    } catch (error) {
      // Release partial context on failure
      if (this.context) {
        try {
          await this.context.release();
        } catch {
          // Ignore release errors during cleanup
        }
        this.context = null;
        this.modelId = null;
      }

      return err(
        createError(
          "UNKNOWN_ERROR",
          "Falha ao carregar modelo Whisper",
          { modelId, path },
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async unloadModel(): Promise<Result<void>> {
    try {
      if (this.context) {
        await this.context.release();
        this.context = null;
        this.modelId = null;
      }
      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Falha ao descarregar modelo Whisper",
          {},
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  getContext(): WhisperContext | null {
    return this.context;
  }
}

let whisperRuntimeInstance: WhisperRuntime | null = null;

/**
 * Gets the singleton WhisperRuntime instance.
 * @returns The WhisperRuntime singleton
 */
export function getWhisperRuntime(): WhisperRuntime {
  if (!whisperRuntimeInstance) {
    whisperRuntimeInstance = new WhisperRuntime();
  }
  return whisperRuntimeInstance;
}
