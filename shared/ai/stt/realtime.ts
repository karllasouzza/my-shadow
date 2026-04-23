import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getActiveContext } from "./runtime";
// @ts-ignore
import { type WhisperContext } from "whisper.rn";

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

class RealtimeTranscriber {
  private isActive = false;
  private stopFn: (() => Promise<void>) | null = null;

  async start(options: RealtimeOptions): Promise<Result<void>> {
    if (this.isActive) {
      return err(
        createError("ALREADY_ACTIVE", "Realtime transcription already active."),
      );
    }

    const contextResult = getActiveContext();
    if (!contextResult.success) return contextResult;
    const context = contextResult.data;

    try {
      let subscribe: (cb: (event: RealtimeEvent) => void) => void;
      let stop: (() => Promise<void>) | undefined;

      if (typeof context.transcribeRealtime === "function") {
        const res = await context.transcribeRealtime({
          language: options.language,
          realtimeAudioSec: 30,
          realtimeAudioMinSec: 0.5,
        });
        stop = res.stop;
        subscribe = res.subscribe;
      } else if (typeof context.transcribe === "function") {
        const res = context.transcribe();
        stop = res.stop ?? (async () => {});
        subscribe = (cb: (event: RealtimeEvent) => void) => {
          res.promise
            .then((r: any) =>
              cb({ data: { result: r.result }, isCapturing: false }),
            )
            .catch((e: unknown) => cb({ error: e }));
        };
      } else {
        throw new Error(
          "Realtime transcription not supported by Whisper context",
        );
      }

      this.isActive = true;
      this.stopFn = stop ?? (async () => {});

      subscribe((event: RealtimeEvent) => {
        if (event.error) {
          this.cleanup();
          return;
        }

        const text = event.data?.result?.trim();
        if (!text) return;

        if (!event.isCapturing) {
          this.cleanup();
          options.onFinalResult(text);
        } else {
          options.onPartialResult?.(text);
        }
      });

      return ok(undefined);
    } catch (error) {
      this.cleanup();
      const msg =
        error instanceof Error
          ? error.message
          : "Error starting realtime transcription.";
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

  async stop(): Promise<Result<void>> {
    if (!this.isActive || !this.stopFn) {
      return ok(undefined);
    }

    try {
      await this.stopFn();
      this.cleanup();
      return ok(undefined);
    } catch (error) {
      this.cleanup();
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Error stopping transcription.",
          {},
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  active(): boolean {
    return this.isActive;
  }

  reset(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.isActive = false;
    this.stopFn = null;
  }
}

const transcriber = new RealtimeTranscriber();

export const startRealtimeTranscription = transcriber.start.bind(transcriber);
export const stopRealtimeTranscription = transcriber.stop.bind(transcriber);
export const isRealtimeTranscriptionActive = transcriber.active.bind(transcriber);

/** @internal — resets state for testing */
export const _resetRealtimeState = transcriber.reset.bind(transcriber);
