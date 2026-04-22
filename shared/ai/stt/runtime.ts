import { createError, err, ok, Result } from "@/shared/utils/app-error";
// @ts-ignore
import { initWhisper, type WhisperContext } from "whisper.rn";

export class WhisperRuntime {
  private context: WhisperContext | null = null;
  private modelId: string | null = null;

  isModelLoaded(id?: string): boolean {
    if (!this.context) return false;
    if (id && this.modelId !== id) return false;
    return true;
  }

  getCurrentModel(): { id: string } | null {
    if (!this.context || !this.modelId) return null;
    return { id: this.modelId };
  }

  async loadModel(
    modelId: string,
    path: string,
  ): Promise<Result<{ id: string }>> {
    try {
      if (this.context && this.modelId === modelId) {
        return ok({ id: modelId });
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
      const msg =
        error instanceof Error
          ? error.message
          : "Falha ao carregar modelo Whisper";
      return err(
        createError(
          "UNKNOWN_ERROR",
          msg,
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
          "Falha ao descarregar modelo",
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

let instance: WhisperRuntime | null = null;

export function getWhisperRuntime(): WhisperRuntime {
  if (!instance) instance = new WhisperRuntime();
  return instance;
}
