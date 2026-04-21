import { createError, err, ok, Result } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { getWhisperRuntime } from "./runtime";
import type { TranscriptionResult } from "./types";

export interface TranscribeOptions {
  language?: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

/**
 * Transcribes an audio file using the loaded Whisper model.
 *
 * @param audioPath - Path to the audio file to transcribe
 * @param options - Optional transcription options
 * @returns Result containing the transcription result or an error
 *
 * @example
 * ```typescript
 * const result = await transcribe('/path/to/audio.wav', {
 *   language: 'pt',
 *   onProgress: (progress) => console.log(`Progress: ${progress}%`),
 * });
 * ```
 */
export async function transcribe(
  audioPath: string,
  options?: TranscribeOptions,
): Promise<Result<TranscriptionResult>> {
  // Guard: Check if Whisper model is loaded
  const runtime = getWhisperRuntime();
  if (!runtime.isModelLoaded()) {
    return err(createError("NOT_READY", "Nenhum modelo Whisper carregado."));
  }

  // Guard: Check if audio file exists
  try {
    const fileInfo = await FileSystem.getInfoAsync(audioPath);
    if (!fileInfo.exists) {
      return err(
        createError("FILE_NOT_FOUND", "Arquivo de áudio não encontrado.", {
          audioPath,
        }),
      );
    }
  } catch (error) {
    return err(
      createError(
        "FILE_NOT_FOUND",
        "Erro ao verificar arquivo de áudio.",
        { audioPath },
        error instanceof Error ? error : undefined,
      ),
    );
  }

  // Get the Whisper context
  const context = runtime.getContext();
  if (!context) {
    return err(createError("NOT_READY", "Contexto Whisper não disponível."));
  }

  try {
    // Prepare transcription options
    const transcribeOptions = {
      language: options?.language,
      ...(options?.onProgress && { onProgress: options.onProgress }),
    };

    // Start transcription
    const { stop, promise } = context.transcribe(audioPath, transcribeOptions);

    // Hook abort signal to stop function
    if (options?.abortSignal) {
      const abortHandler = () => {
        stop();
      };
      options.abortSignal.addEventListener("abort", abortHandler);

      // Clean up listener after transcription completes
      promise.finally(() => {
        options.abortSignal?.removeEventListener("abort", abortHandler);
      });
    }

    // Wait for transcription result
    const whisperResult = await promise;

    // Check if transcription was aborted
    if (whisperResult.isAborted) {
      return err(createError("ABORTED", "Transcrição cancelada."));
    }

    // Map whisper.rn result to TranscriptionResult
    const transcriptionResult: TranscriptionResult = {
      text: whisperResult.result,
      language: whisperResult.language,
      segments: whisperResult.segments.map((segment) => ({
        text: segment.text,
        startMs: segment.t0,
        endMs: segment.t1,
      })),
    };

    return ok(transcriptionResult);
  } catch (error) {
    return err(
      createError(
        "UNKNOWN_ERROR",
        "Erro durante transcrição.",
        { audioPath },
        error instanceof Error ? error : undefined,
      ),
    );
  }
}
