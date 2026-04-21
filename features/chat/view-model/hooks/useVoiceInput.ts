/**
 * useVoiceInput hook
 *
 * Manages voice recording state, STT integration, permission checks,
 * gesture handling, and error recovery for the chat voice input feature.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 6.1, 6.2,
 *               7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2,
 *               9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5,
 *               11.3, 11.4, 11.5
 */

import { useObservable } from "@legendapp/state/react";
import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, Linking } from "react-native";

import {
    startRealtimeTranscription,
    stopRealtimeTranscription,
} from "@/shared/ai/stt/realtime";
import type { AppErrorCode } from "@/shared/utils/app-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceInputStatus = "idle" | "recording" | "processing";

export interface UseVoiceInputOptions {
  /** Called when a non-empty final transcript is ready to be sent */
  onTranscriptReady: (text: string) => void;
  /** Called to navigate to the model download screen */
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
  onSwipeUpdate: (dx: number) => void;
  onSwipeEnd: (dx: number) => void;

  // Actions
  openSettings: () => void;
  dismissNoModelPrompt: () => void;
  confirmModelDownload: () => void;
}

// ---------------------------------------------------------------------------
// Error message mapping (Brazilian Portuguese)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceInput(
  options: UseVoiceInputOptions,
): UseVoiceInputResult {
  // Local Legend State observable — not persisted
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

  const resetToIdle = useCallback(() => {
    clearTimer();
    cancelFlag.current = true;
    voiceState$.set({
      status: "idle",
      partialTranscript: "",
      durationSeconds: 0,
      isCancelPreview: false,
      permissionDenied: voiceState$.permissionDenied.peek(),
      permissionPermanentlyDenied:
        voiceState$.permissionPermanentlyDenied.peek(),
      noModelPromptVisible: false,
      errorMessage: null,
    });
  }, [clearTimer, voiceState$]);

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
      const result = await AudioModule.getRecordingPermissionsAsync();

      if (result.granted) {
        voiceState$.permissionDenied.set(false);
        voiceState$.permissionPermanentlyDenied.set(false);
        return true;
      }

      // canAskAgain === false means permanently denied
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
    const currentStatus = voiceState$.status.peek();
    if (currentStatus !== "idle") return;

    const granted = await checkPermission();
    if (!granted) return;

    cancelFlag.current = false;

    const result = await startRealtimeTranscription({
      language: "pt",
      onPartialResult: (text) => {
        if (cancelFlag.current) return;
        voiceState$.partialTranscript.set(text);
      },
      onFinalResult: (text) => {
        if (cancelFlag.current) return;
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

  const onSwipeUpdate = useCallback(
    (dx: number) => {
      if (voiceState$.status.peek() !== "recording") return;
      voiceState$.isCancelPreview.set(dx <= -40);
    },
    [voiceState$],
  );

  const onSwipeEnd = useCallback(
    (dx: number) => {
      if (voiceState$.status.peek() !== "recording") return;
      if (dx <= -80) {
        // Cancel gesture
        cancelFlag.current = true;
        clearTimer();
        stopRealtimeTranscription().catch(() => {});
        voiceState$.set({
          status: "idle",
          partialTranscript: "",
          durationSeconds: 0,
          isCancelPreview: false,
          permissionDenied: voiceState$.permissionDenied.peek(),
          permissionPermanentlyDenied:
            voiceState$.permissionPermanentlyDenied.peek(),
          noModelPromptVisible: false,
          errorMessage: null,
        });
        AccessibilityInfo.announceForAccessibility("Gravação cancelada");
      } else {
        voiceState$.isCancelPreview.set(false);
      }
    },
    [voiceState$, clearTimer],
  );

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
    onSwipeUpdate,
    onSwipeEnd,
    openSettings,
    dismissNoModelPrompt,
    confirmModelDownload,
  };
}
