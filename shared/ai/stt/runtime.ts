import { createError, err, ok, Result } from "@/shared/utils/app-error";
import type { WhisperContext } from "whisper.rn/src/index";
export class WhisperRuntime {
  private context: WhisperContext | null = null;
  private modelId: string | null = null;
  private loadingPromise: Promise<Result<{ id: string }>> | null = null;

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
      // Dynamically import from src/index so the patch (RNWhisper?.getConstants?.())
      // is applied via Metro's TypeScript compilation, guarding against Android
      // initialization timing where the native module may not be ready yet.
      let initWhisper: typeof import("whisper.rn/src/index").initWhisper;
      try {
        const mod = await import("whisper.rn/src/index");
        initWhisper = mod.initWhisper;
      } catch (importError) {
        return err(
          createError(
            "UNKNOWN_ERROR",
            "Módulo nativo Whisper não pôde ser carregado.",
            { modelId, path },
            importError instanceof Error
              ? importError
              : new Error(String(importError)),
          ),
        );
      }

      if (this.context) {
        await this.context.release();
        this.context = null;
        this.modelId = null;
      }

      const context = await initWhisper({ filePath: path });

      this.context = context;
      this.modelId = modelId;

      return ok({ id: modelId });
    } catch (error) {
      if (this.context) {
        try {
          await this.context.release();
        } catch {
          // ignore
        }
        this.context = null;
        this.modelId = null;
      }

      // Extract the native error message when available (native bridge errors
      // are real Error objects but their message may live on a non-enumerable
      // property or in a nested `userInfo` / `nativeStackAndroid` key).
      const nativeMsg =
        error instanceof Error && error.message
          ? error.message
          : error != null && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : undefined;

      return err(
        createError(
          "UNKNOWN_ERROR",
          nativeMsg ?? "Falha ao carregar modelo Whisper",
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
