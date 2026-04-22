import { createError, err, ok, Result } from "@/shared/utils/app-error";

export class WhisperRuntime {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private context: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vadContext: any = null;
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
      // Dynamically import from whisper.rn main entry point
      let initWhisper: any;
      try {
        const mod = await import("whisper.rn");
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

      // Try to initialize VAD context if we have a model path
      // For now, we skip VAD initialization and let RealtimeTranscriber handle it
      // In the future, VAD can be loaded separately if needed

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContext(): any {
    return this.context;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVadContext(): any {
    return this.vadContext;
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
