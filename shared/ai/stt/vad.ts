import { createError, err, ok, Result } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { getWhisperRuntime } from "./runtime";
import type { SpeechSegment } from "./types";

export interface VADOptions {
  silenceThresholdMs?: number; // default 300
}

/**
 * Detects speech segments in an audio file using Whisper's built-in VAD capabilities.
 *
 * @param audioPath - Path to the audio file to analyze
 * @param options - Optional VAD options
 * @returns Result containing speech segments or an error
 *
 * @example
 * ```typescript
 * const result = await detectSpeechSegments('/path/to/audio.wav', {
 *   silenceThresholdMs: 500,
 * });
 *
 * if (result.success) {
 *   console.log(`Found ${result.data.length} speech segments`);
 *   result.data.forEach(segment => {
 *     console.log(`Speech from ${segment.startMs}ms to ${segment.endMs}ms`);
 *   });
 * }
 * ```
 */
export async function detectSpeechSegments(
  audioPath: string,
  options?: VADOptions,
): Promise<Result<SpeechSegment[]>> {
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
    const silenceThresholdMs = options?.silenceThresholdMs ?? 300;

    // Use whisper.rn's built-in VAD options for speech detection
    const transcribeOptions = {
      // Enable VAD-related options in whisper.rn
      no_speech_thold: 0.6, // Threshold for no-speech detection
      vad_thold: 0.5, // Voice activity detection threshold
      // We don't need the actual transcription text, just the segments
      translate: false,
      language: "auto", // Let Whisper auto-detect language
    };

    // Start transcription with VAD options to get speech segments
    const { promise } = context.transcribe(audioPath, transcribeOptions);

    // Wait for transcription result
    const whisperResult = await promise;

    // Check if transcription was aborted or failed
    if (whisperResult.isAborted) {
      return err(createError("ABORTED", "Detecção de fala cancelada."));
    }

    // Extract segments from transcription result
    const rawSegments = whisperResult.segments || [];

    // Filter out segments that are too short (below silence threshold)
    // and map to SpeechSegment format
    const speechSegments: SpeechSegment[] = [];

    for (const segment of rawSegments) {
      const duration = segment.t1 - segment.t0;

      // Only include segments that are longer than the silence threshold
      if (duration >= silenceThresholdMs) {
        speechSegments.push({
          startMs: segment.t0,
          endMs: segment.t1,
        });
      }
    }

    // Merge adjacent segments that are separated by less than silenceThresholdMs
    const mergedSegments: SpeechSegment[] = [];

    for (const segment of speechSegments) {
      if (mergedSegments.length === 0) {
        mergedSegments.push(segment);
        continue;
      }

      const lastSegment = mergedSegments[mergedSegments.length - 1];
      const gap = segment.startMs - lastSegment.endMs;

      // If gap is smaller than silence threshold, merge segments
      if (gap < silenceThresholdMs) {
        lastSegment.endMs = segment.endMs;
      } else {
        mergedSegments.push(segment);
      }
    }

    // Return empty array if no speech detected (as per requirement 8.2)
    return ok(mergedSegments);
  } catch (error) {
    return err(
      createError(
        "UNKNOWN_ERROR",
        "Erro durante detecção de fala.",
        { audioPath },
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

/**
 * Performs real-time speech detection on a single audio chunk.
 *
 * @param audioChunk - Float32Array containing PCM audio data
 * @returns true if speech is detected, false otherwise
 *
 * @example
 * ```typescript
 * const audioData = new Float32Array([...]);
 * const hasSpeech = isSpeaking(audioData);
 * console.log(hasSpeech ? 'Speech detected' : 'Silence');
 * ```
 */
export function isSpeaking(audioChunk: Float32Array): boolean {
  // Lightweight energy-threshold check on raw PCM chunk
  // Calculate RMS (Root Mean Square) energy of the audio chunk
  let sumSquares = 0;
  for (let i = 0; i < audioChunk.length; i++) {
    sumSquares += audioChunk[i] * audioChunk[i];
  }

  const rms = Math.sqrt(sumSquares / audioChunk.length);

  // Use a simple energy threshold to detect speech
  // This threshold may need tuning based on real-world usage
  const energyThreshold = 0.01; // Adjust based on testing

  return rms > energyThreshold;
}
