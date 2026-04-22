import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getWhisperRuntime } from "./runtime";

export interface RealtimeOptions {
  language?: string;
  onPartialResult: (text: string) => void;
  onFinalResult: (text: string) => void;
}

let isActive = false;
let stopFn: (() => Promise<void>) | null = null;

/**
 * Starts real-time transcription from the microphone using whisper.rn's
 * native `transcribeRealtime` method. Audio capture is handled entirely by
 * the native module — no external recorder is required.
 *
 * On Android the `RECORD_AUDIO` permission must be granted before calling
 * this function.
 */
export async function startRealtimeTranscription(
  options: RealtimeOptions,
): Promise<Result<void>> {
  if (isActive) {
    return err(
      createError("ALREADY_ACTIVE", "Sessão de transcrição já ativa."),
    );
  }

  const runtime = getWhisperRuntime();
  if (!runtime.isModelLoaded()) {
    return err(createError("NOT_READY", "Nenhum modelo Whisper carregado."));
  }

  const context = runtime.getContext();
  if (!context) {
    return err(createError("NOT_READY", "Contexto Whisper não disponível."));
  }

  try {
    const { stop, subscribe } = await context.transcribeRealtime({
      language: options.language,
      useVad: true,
      realtimeAudioSec: 30,
      realtimeAudioMinSec: 0.5,
    });

    isActive = true;
    stopFn = stop;

    type RealtimeEvent = {
      error?: string;
      data?: { result: string };
      isCapturing: boolean;
    };
    subscribe((event: RealtimeEvent) => {
      if (event.error) {
        isActive = false;
        stopFn = null;
        return;
      }

      const text = event.data?.result?.trim();
      if (!text) return;

      if (!event.isCapturing) {
        isActive = false;
        stopFn = null;
        options.onFinalResult(text);
      } else {
        options.onPartialResult(text);
      }
    });

    return ok(undefined);
  } catch (error) {
    isActive = false;
    stopFn = null;

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("permission") ||
        msg.includes("record_audio") ||
        msg.includes("microphone")
      ) {
        return err(
          createError("PERMISSION_DENIED", "Permissão de microfone negada."),
        );
      }
      if (
        msg.includes("out of memory") ||
        msg.includes("oom") ||
        msg.includes("insufficient memory")
      ) {
        return err(
          createError(
            "OUT_OF_MEMORY",
            "Memória insuficiente durante transcrição em tempo real.",
          ),
        );
      }
    }

    return err(
      createError(
        "UNKNOWN_ERROR",
        "Erro ao iniciar transcrição em tempo real.",
        {},
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

/**
 * Stops the active real-time transcription session.
 */
export async function stopRealtimeTranscription(): Promise<Result<void>> {
  if (!isActive || !stopFn) {
    return ok(undefined);
  }

  const currentStop = stopFn;

  try {
    await currentStop();
    // isActive / stopFn are also reset by the subscribe callback when the
    // final event (isCapturing: false) arrives, but reset here too for safety.
    isActive = false;
    stopFn = null;
    return ok(undefined);
  } catch (error) {
    isActive = false;
    stopFn = null;
    return err(
      createError(
        "UNKNOWN_ERROR",
        "Erro ao parar transcrição em tempo real.",
        {},
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

/**
 * Returns whether a realtime transcription session is currently active.
 */
export function isRealtimeTranscriptionActive(): boolean {
  return isActive;
}

/**
 * Resets internal state. For testing purposes only.
 * @internal
 */
export function _resetRealtimeState(): void {
  isActive = false;
  stopFn = null;
}

