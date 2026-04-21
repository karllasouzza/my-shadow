import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { getWhisperRuntime } from "./runtime";

export interface RealtimeOptions {
  language?: string;
  onPartialResult: (text: string) => void;
  onFinalResult: (text: string) => void;
}

// Global state for realtime transcription session
let isActive = false;
let currentRecorder: any = null;
let transcriptionInterval: NodeJS.Timeout | null = null;
let lastPartialEmitTime = 0;
let accumulatedText = "";
let currentOptions: RealtimeOptions | null = null;

/**
 * Starts real-time transcription from microphone input.
 *
 * @param options - Configuration options for real-time transcription
 * @returns Result indicating success or failure with error details
 *
 * @example
 * ```typescript
 * const result = await startRealtimeTranscription({
 *   language: 'pt',
 *   onPartialResult: (text) => console.log('Partial:', text),
 *   onFinalResult: (text) => console.log('Final:', text),
 * });
 * ```
 */
export async function startRealtimeTranscription(
  options: RealtimeOptions,
): Promise<Result<void>> {
  // Guard: Check if session is already active
  if (isActive) {
    return err(
      createError("ALREADY_ACTIVE", "Sessão de transcrição já ativa."),
    );
  }

  // Guard: Check if Whisper model is loaded
  const runtime = getWhisperRuntime();
  if (!runtime.isModelLoaded()) {
    return err(createError("NOT_READY", "Nenhum modelo Whisper carregado."));
  }

  try {
    // Import expo-audio dynamically to handle cases where it might not be installed
    const { AudioModule, AudioRecorder } = await import("expo-audio");

    // Guard: Request microphone permissions
    const permissionResult =
      await AudioModule.requestRecordingPermissionsAsync();
    if (!permissionResult.granted) {
      return err(
        createError("PERMISSION_DENIED", "Permissão de microfone negada."),
      );
    }

    // Create AudioRecorder with 16 kHz mono configuration suitable for Whisper
    const recorder = new AudioRecorder({
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
      format: "wav", // PCM format suitable for Whisper
    });

    // Start recording
    await recorder.startAsync();

    // Set session state
    isActive = true;
    currentRecorder = recorder;
    currentOptions = options;
    accumulatedText = "";
    lastPartialEmitTime = 0;

    // Start polling for audio data every 500ms
    transcriptionInterval = setInterval(async () => {
      await processAudioChunk();
    }, 500);

    return ok(undefined);
  } catch (error) {
    // Reset state on error
    isActive = false;
    currentRecorder = null;
    currentOptions = null;

    if (
      error instanceof Error &&
      error.message.includes("Cannot resolve module")
    ) {
      return err(
        createError(
          "NOT_READY",
          "Módulo expo-audio não disponível. Instale com: expo install expo-audio",
        ),
      );
    }

    // Check for out of memory errors
    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("out of memory") ||
        error.message.toLowerCase().includes("oom") ||
        error.message.toLowerCase().includes("insufficient memory"))
    ) {
      return err(
        createError(
          "OUT_OF_MEMORY",
          "Memória insuficiente durante transcrição em tempo real.",
        ),
      );
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
 *
 * @returns Result indicating success or failure
 */
export async function stopRealtimeTranscription(): Promise<Result<void>> {
  if (!isActive) {
    return ok(undefined); // Already stopped, return success
  }

  // Store the callback and accumulated text before clearing state
  const finalText = accumulatedText;
  const options = currentOptions;

  try {
    // Clear the polling interval
    if (transcriptionInterval) {
      clearInterval(transcriptionInterval);
      transcriptionInterval = null;
    }

    // Stop and release the recorder
    if (currentRecorder) {
      await currentRecorder.stopAsync();

      // Process any remaining audio for final result
      await processFinalAudio();

      // Release recorder resources
      currentRecorder = null;
    }

    // Reset session state
    isActive = false;
    currentOptions = null;
    accumulatedText = "";
    lastPartialEmitTime = 0;

    // Emit final result if we have accumulated text and a callback
    if (options && finalText.trim()) {
      options.onFinalResult(finalText.trim());
    }

    return ok(undefined);
  } catch (error) {
    // Reset state even on error to prevent stuck sessions
    isActive = false;
    currentRecorder = null;
    currentOptions = null;
    transcriptionInterval = null;
    accumulatedText = "";
    lastPartialEmitTime = 0;

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
 * Processes audio chunks during active transcription session.
 * Emits partial results at most once every 500ms to avoid overwhelming the UI.
 */
async function processAudioChunk(): Promise<void> {
  if (!isActive || !currentRecorder || !currentOptions) {
    return;
  }

  try {
    const runtime = getWhisperRuntime();
    const context = runtime.getContext();

    if (!context) {
      // Model was unloaded during session, stop gracefully
      await stopRealtimeTranscription();
      return;
    }

    // Get the current recording URI
    const audioUri = currentRecorder.uri;
    if (!audioUri) {
      return; // No audio data yet
    }

    // Transcribe the current audio
    const { promise } = context.transcribe(audioUri, {
      language: currentOptions.language,
    });

    const result = await promise;

    if (result.result && result.result.trim()) {
      const currentTime = Date.now();

      // Update accumulated text
      accumulatedText = result.result.trim();

      // Emit partial result at most once every 500ms
      if (currentTime - lastPartialEmitTime >= 500) {
        currentOptions.onPartialResult(accumulatedText);
        lastPartialEmitTime = currentTime;
      }
    }
  } catch (error) {
    // Handle out of memory errors gracefully
    if (
      error instanceof Error &&
      (error.message.toLowerCase().includes("out of memory") ||
        error.message.toLowerCase().includes("oom") ||
        error.message.toLowerCase().includes("insufficient memory"))
    ) {
      // Stop session gracefully and emit final result
      const finalText = accumulatedText;
      await stopRealtimeTranscription();

      if (finalText && currentOptions) {
        currentOptions.onFinalResult(finalText);
      }

      // Note: We don't throw here as the error will be handled by the caller
      return;
    }

    // For other errors, continue processing (don't break the session)
    console.warn("Error processing audio chunk:", error);
  }
}

/**
 * Processes any remaining audio for the final transcription result.
 */
async function processFinalAudio(): Promise<void> {
  // The final result is already accumulated in accumulatedText
  // This function is called during stopRealtimeTranscription
  // and the final result will be emitted by the caller
}

/**
 * Gets the current status of the realtime transcription session.
 *
 * @returns True if a session is currently active, false otherwise
 */
export function isRealtimeTranscriptionActive(): boolean {
  return isActive;
}

/**
 * Resets the internal state of the realtime transcription module.
 * This is primarily for testing purposes.
 *
 * @internal
 */
export function _resetRealtimeState(): void {
  isActive = false;
  currentRecorder = null;
  currentOptions = null;
  if (transcriptionInterval) {
    clearInterval(transcriptionInterval);
    transcriptionInterval = null;
  }
  lastPartialEmitTime = 0;
  accumulatedText = "";
}
