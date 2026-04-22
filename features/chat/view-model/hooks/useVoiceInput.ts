import { useObservable } from "@legendapp/state/react";
import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, Linking } from "react-native";

import {
  startRealtimeTranscription,
  stopRealtimeTranscription,
} from "@/shared/ai/stt/realtime";
import type { AppErrorCode } from "@/shared/utils/app-error";
import { AudioModule } from "expo-audio";

export type VoiceInputStatus = "idle" | "recording" | "processing";

export interface UseVoiceInputOptions {
  onTranscriptReady: (text: string) => void;
  onNavigateToModelDownload: () => void;
}

export interface UseVoiceInputResult {
  status: VoiceInputStatus;
  partialTranscript: string;
  recordingDurationSeconds: number;
  isCancelPreview: boolean;
  permissionDenied: boolean;
  permissionPermanentlyDenied: boolean;
  noModelPromptVisible: boolean;
  errorMessage: string | null;

  // Gesture handlers
  onPressIn: () => void;
  onPressOut: () => void;
  onTap: () => void;

  // Actions
  openSettings: () => void;
  dismissNoModelPrompt: () => void;
  confirmModelDownload: () => void;
}

function getErrorMessage(code: AppErrorCode): string {
  switch (code) {
    case "PERMISSION_DENIED":
      return "Permissão de microfone negada. Habilite nas configurações.";
    case "NOT_READY":
      // NOT_READY is handled separately via noModelPromptVisible
      return "Nenhum modelo de voz carregado. Deseja baixar um agora?";
    case "ALREADY_ACTIVE":
      return "Erro ao iniciar gravação. Tente novamente.";
    case "OUT_OF_MEMORY":
      return "Memória insuficiente. Gravação encerrada.";
    case "UNKNOWN_ERROR":
    default:
      return "Erro ao iniciar gravação. Tente novamente.";
  }
}

const STOP_ERROR_MESSAGE = "Erro ao processar gravação. Tente novamente.";

export function useVoiceInput(
  options: UseVoiceInputOptions,
): UseVoiceInputResult {
  const voiceState$ = useObservable({
    status: "idle" as VoiceInputStatus,
    partialTranscript: "",
    durationSeconds: 0,
    isCancelPreview: false,
    permissionDenied: false,
    permissionPermanentlyDenied: false,
    noModelPromptVisible: false,
    errorMessage: null as string | null,
  });

  // Refs for cleanup
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFlag = useRef(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearErrorTimers = useCallback(() => {
    if (errorClearRef.current !== null) {
      clearTimeout(errorClearRef.current);
      errorClearRef.current = null;
    }
    if (errorResetRef.current !== null) {
      clearTimeout(errorResetRef.current);
      errorResetRef.current = null;
    }
  }, []);

  const handleError = useCallback(
    (code: AppErrorCode) => {
      clearTimer();
      clearErrorTimers();
      cancelFlag.current = true;

      if (code === "NOT_READY") {
        voiceState$.status.set("idle");
        voiceState$.noModelPromptVisible.set(true);
        return;
      }

      const msg = getErrorMessage(code);

      // Transition to idle within 500 ms (Requirement 9.4)
      errorResetRef.current = setTimeout(() => {
        voiceState$.status.set("idle");
        voiceState$.partialTranscript.set("");
        voiceState$.durationSeconds.set(0);
        voiceState$.isCancelPreview.set(false);
      }, 500);

      voiceState$.errorMessage.set(msg);

      // Clear error message after 3 s (Requirement 9.4 / design)
      errorClearRef.current = setTimeout(() => {
        voiceState$.errorMessage.set(null);
      }, 3000);
    },
    [clearTimer, clearErrorTimers, voiceState$],
  );

  // ---------------------------------------------------------------------------
  // Permission check
  // ---------------------------------------------------------------------------

  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { AudioModule } = await import("expo-audio");

      // First check if already granted
      let result = await AudioModule.getRecordingPermissionsAsync();

      if (result.granted) {
        voiceState$.permissionDenied.set(false);
        voiceState$.permissionPermanentlyDenied.set(false);
        return true;
      }

      // If not granted but we can ask again, request permission
      if (result.canAskAgain) {
        result = await AudioModule.requestRecordingPermissionsAsync();

        if (result.granted) {
          voiceState$.permissionDenied.set(false);
          voiceState$.permissionPermanentlyDenied.set(false);
          return true;
        }
      }

      // Permission denied or permanently denied
      const permanent = result.canAskAgain === false;
      voiceState$.permissionDenied.set(true);
      voiceState$.permissionPermanentlyDenied.set(permanent);
      voiceState$.errorMessage.set(
        "Permissão de microfone negada. Habilite nas configurações.",
      );

      // Clear error after 3 s
      clearErrorTimers();
      errorClearRef.current = setTimeout(() => {
        voiceState$.errorMessage.set(null);
      }, 3000);

      return false;
    } catch {
      return false;
    }
  }, [voiceState$, clearErrorTimers]);

  // ---------------------------------------------------------------------------
  // Start recording
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    console.log("[Voice] Starting recording...");
    const currentStatus = voiceState$.status.peek();
    if (currentStatus !== "idle") return;

    const granted = await checkPermission();
    console.log("[Voice] Permission granted:", granted);
    if (!granted) return;

    cancelFlag.current = false;

    // Set audio mode to allow recording
    try {
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.log("[Voice] Failed to set audio mode:", error);
      // Continue anyway — audio mode might already be set
    }

    const result = await startRealtimeTranscription({
      language: "pt",
      onPartialResult: (text) => {
        console.log("[Voice] Partial result:", text);
        if (cancelFlag.current) return;
        voiceState$.partialTranscript.set(text);
      },
      onFinalResult: (text) => {
        if (cancelFlag.current) return;
        console.log("[Voice] Final result:", text);
        const trimmed = text.trim();
        voiceState$.status.set("idle");
        voiceState$.partialTranscript.set("");
        voiceState$.durationSeconds.set(0);
        clearTimer();
        AccessibilityInfo.announceForAccessibility("Gravação concluída");

        if (trimmed.length > 0) {
          options.onTranscriptReady(trimmed);
        }
      },
    });
    console.log("[Voice] startRealtimeTranscription result:", result);

    if (!result.success) {
      handleError(result.error.code);
      return;
    }

    voiceState$.status.set("recording");
    AccessibilityInfo.announceForAccessibility("Gravação iniciada");

    // Start duration timer
    timerRef.current = setInterval(() => {
      if (voiceState$.status.peek() === "recording") {
        voiceState$.durationSeconds.set(voiceState$.durationSeconds.peek() + 1);
      } else {
        clearTimer();
      }
    }, 1000);
  }, [voiceState$, checkPermission, handleError, clearTimer, options]);

  // ---------------------------------------------------------------------------
  // Stop recording (transition to processing)
  // ---------------------------------------------------------------------------

  const stopRecording = useCallback(async () => {
    const currentStatus = voiceState$.status.peek();
    if (currentStatus !== "recording") return;

    console.log("[Voice] Stopping recording...");
    clearTimer();
    voiceState$.status.set("processing");
    voiceState$.isCancelPreview.set(false);

    const result = await stopRealtimeTranscription();
    if (!result.success) {
      voiceState$.partialTranscript.set("");
      handleError("UNKNOWN_ERROR");
      voiceState$.errorMessage.set(STOP_ERROR_MESSAGE);
    }
    // onFinalResult callback handles the idle transition
  }, [voiceState$, clearTimer, handleError]);

  // ---------------------------------------------------------------------------
  // Gesture handlers
  // ---------------------------------------------------------------------------

  const onPressIn = useCallback(() => {
    startRecording();
  }, [startRecording]);

  const onPressOut = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const onTap = useCallback(() => {
    const status = voiceState$.status.peek();
    if (status === "idle") {
      startRecording();
    } else if (status === "recording") {
      stopRecording();
    }
    // processing: ignore
  }, [voiceState$, startRecording, stopRecording]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const dismissNoModelPrompt = useCallback(() => {
    voiceState$.noModelPromptVisible.set(false);
    voiceState$.status.set("idle");
  }, [voiceState$]);

  const confirmModelDownload = useCallback(() => {
    voiceState$.noModelPromptVisible.set(false);
    voiceState$.status.set("idle");
    options.onNavigateToModelDownload();
  }, [voiceState$, options]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      cancelFlag.current = true;
      clearTimer();
      clearErrorTimers();
      voiceState$.set({
        status: "idle",
        partialTranscript: "",
        durationSeconds: 0,
        isCancelPreview: false,
        permissionDenied: false,
        permissionPermanentlyDenied: false,
        noModelPromptVisible: false,
        errorMessage: null,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  const state = voiceState$.get();

  return {
    status: state.status,
    partialTranscript: state.partialTranscript,
    recordingDurationSeconds: state.durationSeconds,
    isCancelPreview: state.isCancelPreview,
    permissionDenied: state.permissionDenied,
    permissionPermanentlyDenied: state.permissionPermanentlyDenied,
    noModelPromptVisible: state.noModelPromptVisible,
    errorMessage: state.errorMessage,
    onPressIn,
    onPressOut,
    onTap,
    openSettings,
    dismissNoModelPrompt,
    confirmModelDownload,
  };
}
