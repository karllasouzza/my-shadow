import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getActiveContext } from "./runtime";
import type { SpeechSegment } from "./types";

export interface VADOptions {
  silenceThresholdMs?: number;
}

function convertAndFilterSegments(
  rawSegments: Array<{ t0: number; t1: number }>,
  thresholdMs: number,
): SpeechSegment[] {
  const result: SpeechSegment[] = [];
  for (const segment of rawSegments) {
    const startMs = segment.t0;
    const endMs = segment.t1;
    if (endMs - startMs >= thresholdMs) {
      result.push({ startMs, endMs });
    }
  }
  return result;
}

function mergeAdjacentSegments(
  segments: SpeechSegment[],
  thresholdMs: number,
): SpeechSegment[] {
  const merged: SpeechSegment[] = [];
  for (const segment of segments) {
    if (merged.length === 0) {
      merged.push(segment);
      continue;
    }
    const last = merged[merged.length - 1];
    if (segment.startMs - last.endMs < thresholdMs) {
      last.endMs = segment.endMs;
    } else {
      merged.push(segment);
    }
  }
  return merged;
}

/**
 * Detects speech segments in an audio file using Whisper's built-in VAD capabilities.
 * whisper.rn returns segment timestamps (t0/t1) in milliseconds.
 */
export async function detectSpeechSegments(
  audioPath: string,
  options?: VADOptions,
): Promise<Result<SpeechSegment[]>> {
  const contextResult = getActiveContext();
  if (!contextResult.success) return contextResult;
  const context = contextResult.data;

  try {
    const silenceThresholdMs = options?.silenceThresholdMs ?? 300;

    const { promise } = context.transcribe(audioPath, {
      translate: false,
      language: "auto",
    });

    const whisperResult = await promise;

    if (whisperResult.isAborted) {
      return err(createError("ABORTED", "Speech detection cancelled."));
    }

    const rawSegments = whisperResult.segments ?? [];
    const speechSegments = convertAndFilterSegments(
      rawSegments,
      silenceThresholdMs,
    );
    const mergedSegments = mergeAdjacentSegments(
      speechSegments,
      silenceThresholdMs,
    );

    return ok(mergedSegments);
  } catch (error) {
    return err(
      createError(
        "UNKNOWN_ERROR",
        "Error during speech detection.",
        { audioPath },
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

const ENERGY_THRESHOLD = 0.01;

/**
 * Performs real-time speech detection on a single audio chunk using RMS energy.
 * Threshold may need tuning based on real-world usage.
 */
export function isSpeaking(audioChunk: Float32Array): boolean {
  let sumSquares = 0;
  for (let i = 0; i < audioChunk.length; i++) {
    sumSquares += audioChunk[i] * audioChunk[i];
  }
  const rms = Math.sqrt(sumSquares / audioChunk.length);
  return rms > ENERGY_THRESHOLD;
}
