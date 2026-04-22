import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getWhisperRuntime } from "./runtime";
import type { TranscriptionResult } from "./types";

export interface TranscribeOptions {
  language?: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

/**
 * Transcribes an audio file using the loaded Whisper model.
 * whisper.rn handles file validation internally — no need to pre-check existence.
 */
export async function transcribe(
  audioPath: string,
  options?: TranscribeOptions,
): Promise<Result<TranscriptionResult>> {
  const runtime = getWhisperRuntime();
  if (!runtime.isModelLoaded()) {
    return err(createError("NOT_READY", "Nenhum modelo Whisper carregado."));
  }

  const context = runtime.getContext();
  if (!context) {
    return err(createError("NOT_READY", "Contexto Whisper não disponível."));
  }

  try {
    const { stop, promise } = context.transcribe(audioPath, {
      language: options?.language,
      ...(options?.onProgress && { onProgress: options.onProgress }),
    });

    if (options?.abortSignal) {
      const onAbort = () => stop();
      options.abortSignal.addEventListener("abort", onAbort);
      promise.finally(() =>
        options.abortSignal?.removeEventListener("abort", onAbort),
      );
    }

    const whisperResult = await promise;

    if (whisperResult.isAborted) {
      return err(createError("ABORTED", "Transcrição cancelada."));
    }

    const result: TranscriptionResult = {
      text: whisperResult.result,
      language: whisperResult.language,
      segments: (whisperResult.segments ?? []).map(
        (s: { text: string; t0: number; t1: number }) => ({
          text: s.text,
          startMs: s.t0,
          endMs: s.t1,
        }),
      ),
    };

    return ok(result);
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Erro durante transcrição.";
    return err(
      createError(
        "UNKNOWN_ERROR",
        msg,
        { audioPath },
        error instanceof Error ? error : undefined,
      ),
    );
  }
}
