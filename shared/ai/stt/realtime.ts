import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getWhisperRuntime } from "./runtime";

type RealtimeEvent = {
  error?: unknown;
  data?: {
    result?: string | null;
  } | null;
  isCapturing?: boolean;
};

export interface RealtimeOptions {
  language?: string;
  onPartialResult?: (text: string) => void;
  onFinalResult: (text: string) => void;
}

let isActive = false;
let stopFn: (() => Promise<void>) | null = null;

/**
 * Starts real-time transcription from the microphone.
 * Uses whisper.rn's built-in `transcribeRealtime` (deprecated but self-contained;
 * for advanced use consider `RealtimeTranscriber` from `whisper.rn/realtime-transcription`).
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
    // `whisper.rn` contexts may expose either `transcribeRealtime` (preferred)
    // or a simpler `transcribe` helper in tests/mocks. Support both.
    let subscribe: (cb: (event: RealtimeEvent) => void) => void;
    let stop: (() => Promise<void>) | undefined;

    if (typeof (context as any).transcribeRealtime === "function") {
      const res = await (context as any).transcribeRealtime({
        language: options.language,
        realtimeAudioSec: 30,
        realtimeAudioMinSec: 0.5,
      });
      stop = res.stop;
      subscribe = res.subscribe;
    } else if (typeof (context as any).transcribe === "function") {
      // Fallback for test harnesses that only provide `transcribe()` which
      // returns a promise for a final result. Convert it into a single-call
      // subscribe so the rest of the logic can remain unchanged.
      const res = (context as any).transcribe();
      stop = res.stop ?? (async () => {});
      subscribe = (cb: (event: RealtimeEvent) => void) => {
        res.promise
          .then((r: any) => cb({ data: { result: r.result }, isCapturing: false }))
          .catch((e: unknown) => cb({ error: e }));
      };
    } else {
      throw new Error("Realtime transcription not supported by Whisper context");
    }

    isActive = true;
    stopFn = stop ?? (async () => {});

    subscribe((event: RealtimeEvent) => {
      if (event.error) {
        cleanup();
        return;
      }

      const text = event.data?.result?.trim();
      if (!text) return;

      if (!event.isCapturing) {
        cleanup();
        options.onFinalResult(text);
      } else {
        options.onPartialResult?.(text);
      }
    });

    return ok(undefined);
  } catch (error) {
    cleanup();
    const msg =
      error instanceof Error
        ? error.message
        : "Erro ao iniciar transcrição em tempo real.";
    return err(
      createError(
        "UNKNOWN_ERROR",
        msg,
        {},
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

export async function stopRealtimeTranscription(): Promise<Result<void>> {
  if (!isActive || !stopFn) {
    return ok(undefined);
  }

  try {
    await stopFn();
    cleanup();
    return ok(undefined);
  } catch (error) {
    cleanup();
    return err(
      createError(
        "UNKNOWN_ERROR",
        "Erro ao parar transcrição.",
        {},
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

export function isRealtimeTranscriptionActive(): boolean {
  return isActive;
}

function cleanup(): void {
  isActive = false;
  stopFn = null;
}

/** @internal */
export function _resetRealtimeState(): void {
  cleanup();
}
