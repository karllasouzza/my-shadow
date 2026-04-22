import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getWhisperRuntime } from "./runtime";

export interface RealtimeOptions {
  language?: string;
  onPartialResult: (text: string) => void;
  onFinalResult: (text: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;
let isActive = false;
let accumulatedResult = "";
let recordingActive = false;

/**
 * Starts real-time transcription from the microphone using expo-audio
 * and whisper.rn. Audio is recorded and transcribed in real-time.
 *
 * On Android the `RECORD_AUDIO` permission must be granted before calling
 * this function.
 */
export async function startRealtimeTranscription(
  options: RealtimeOptions,
): Promise<Result<void>> {
  if (isActive && transcriber) {
    return err(
      createError("ALREADY_ACTIVE", "Sessão de transcrição já ativa."),
    );
  }

  const runtime = getWhisperRuntime();

  // Check if model is loaded before trying to transcribe
  if (!runtime.isModelLoaded()) {
    return err(createError("NOT_READY", "Nenhum modelo Whisper carregado."));
  }

  const whisperContext = runtime.getContext();
  if (!whisperContext) {
    return err(createError("NOT_READY", "Nenhum modelo Whisper carregado."));
  }

  try {
    // Import required modules
    const audioModule = await import("expo-audio");
    const { AudioModule, AudioRecorder } = audioModule as any;

    // Check and request permission
    let result = await AudioModule.requestRecordingPermissionsAsync();
    if (!result.granted) {
      if (!result.canAskAgain) {
        return err(
          createError("PERMISSION_DENIED", "Permissão de microfone negada."),
        );
      }
      result = await AudioModule.requestRecordingPermissionsAsync();
      if (!result.granted) {
        return err(
          createError("PERMISSION_DENIED", "Permissão de microfone negada."),
        );
      }
    }

    // Set audio mode for recording (may not be available in all environments)
    try {
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch {
      // Continue anyway — audio mode might already be set
    }

    // Initialize recorder
    const recorder = AudioRecorder();
    recordingActive = true;
    accumulatedResult = "";

    // Start recording
    await recorder.startAsync();

    // Create transcriber object
    transcriber = {
      recorder,
      async stop() {
        try {
          recordingActive = false;
          await this.recorder.stopAsync();

          const uri = this.recorder.uri;

          // Transcribe the recorded audio
          if (uri && whisperContext) {
            try {
              const transcribeResult = await whisperContext.transcribe(uri, {
                language: options.language || "pt",
              });

              if (!transcribeResult.isAborted) {
                accumulatedResult = transcribeResult.result || "";
                options.onPartialResult(accumulatedResult);
                options.onFinalResult(accumulatedResult);
              }
            } catch (transcribeError) {
              // If transcription fails, notify with empty result
              options.onFinalResult("");
            }
          }

          return { uri };
        } catch (error) {
          options.onFinalResult("");
          throw error;
        }
      },
    };

    isActive = true;

    return ok(undefined);
  } catch (error) {
    transcriber = null;
    isActive = false;
    recordingActive = false;
    accumulatedResult = "";

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
  if (!isActive || !transcriber) {
    return ok(undefined);
  }

  try {
    await transcriber.stop();
    transcriber = null;
    isActive = false;
    recordingActive = false;
    accumulatedResult = "";
    return ok(undefined);
  } catch (error) {
    transcriber = null;
    isActive = false;
    recordingActive = false;
    accumulatedResult = "";
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
  transcriber = null;
  recordingActive = false;
  accumulatedResult = "";
}
