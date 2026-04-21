/**
 * Pure state machine reducer for voice input.
 *
 * Extracted from useVoiceInput to enable property-based testing
 * of state transitions without React or async side effects.
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 10.6
 */

import type { AppErrorCode } from "@/shared/utils/app-error";
import type { VoiceInputStatus } from "./useVoiceInput";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface VoiceInputState {
  status: VoiceInputStatus;
  partialTranscript: string;
  durationSeconds: number;
  isCancelPreview: boolean;
  permissionDenied: boolean;
  permissionPermanentlyDenied: boolean;
  noModelPromptVisible: boolean;
  errorMessage: string | null;
}

export const initialVoiceInputState: VoiceInputState = {
  status: "idle",
  partialTranscript: "",
  durationSeconds: 0,
  isCancelPreview: false,
  permissionDenied: false,
  permissionPermanentlyDenied: false,
  noModelPromptVisible: false,
  errorMessage: null,
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type VoiceInputEvent =
  | { type: "TAP" }
  | { type: "LONG_PRESS_START" }
  | { type: "LONG_PRESS_END" }
  | { type: "CANCEL"; dx: number }
  | { type: "FINAL_TRANSCRIPT"; text: string }
  | { type: "PARTIAL_TRANSCRIPT"; text: string }
  | { type: "ERROR"; code: AppErrorCode }
  | { type: "PERMISSION_DENIED"; permanent: boolean }
  | { type: "RECORDING_STARTED" }
  | { type: "TICK" };

// ---------------------------------------------------------------------------
// Error message mapping (Brazilian Portuguese)
// ---------------------------------------------------------------------------

function getErrorMessage(code: AppErrorCode): string {
  switch (code) {
    case "PERMISSION_DENIED":
      return "Permissão de microfone negada. Habilite nas configurações.";
    case "NOT_READY":
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

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer for voice input state transitions.
 * Does NOT handle async side effects — those live in useVoiceInput.
 */
export function voiceInputReducer(
  state: VoiceInputState,
  event: VoiceInputEvent,
): VoiceInputState {
  switch (event.type) {
    case "TAP": {
      if (state.status === "idle") {
        // Will transition to recording after permission check + STT start
        // Represented here as a no-op until RECORDING_STARTED is dispatched
        return state;
      }
      if (state.status === "recording") {
        return {
          ...state,
          status: "processing",
          isCancelPreview: false,
        };
      }
      // processing: ignore
      return state;
    }

    case "LONG_PRESS_START": {
      if (state.status === "idle") {
        return state; // Waits for RECORDING_STARTED
      }
      return state;
    }

    case "LONG_PRESS_END": {
      if (state.status === "recording") {
        return {
          ...state,
          status: "processing",
          isCancelPreview: false,
        };
      }
      return state;
    }

    case "RECORDING_STARTED": {
      if (state.status === "idle") {
        return {
          ...state,
          status: "recording",
          partialTranscript: "",
          durationSeconds: 0,
          isCancelPreview: false,
          errorMessage: null,
        };
      }
      return state;
    }

    case "CANCEL": {
      if (state.status === "recording") {
        if (event.dx <= -80) {
          return {
            ...state,
            status: "idle",
            partialTranscript: "",
            durationSeconds: 0,
            isCancelPreview: false,
            errorMessage: null,
          };
        }
        if (event.dx <= -40) {
          return { ...state, isCancelPreview: true };
        }
        return { ...state, isCancelPreview: false };
      }
      return state;
    }

    case "FINAL_TRANSCRIPT": {
      if (state.status === "processing") {
        return {
          ...state,
          status: "idle",
          partialTranscript: "",
          durationSeconds: 0,
          isCancelPreview: false,
        };
      }
      return state;
    }

    case "PARTIAL_TRANSCRIPT": {
      if (state.status === "recording") {
        return { ...state, partialTranscript: event.text };
      }
      return state;
    }

    case "ERROR": {
      if (event.code === "NOT_READY") {
        return {
          ...state,
          status: "idle",
          noModelPromptVisible: true,
          partialTranscript: "",
          durationSeconds: 0,
          isCancelPreview: false,
        };
      }
      return {
        ...state,
        status: "idle",
        partialTranscript: "",
        durationSeconds: 0,
        isCancelPreview: false,
        errorMessage: getErrorMessage(event.code),
      };
    }

    case "PERMISSION_DENIED": {
      return {
        ...state,
        status: "idle",
        permissionDenied: true,
        permissionPermanentlyDenied: event.permanent,
        errorMessage:
          "Permissão de microfone negada. Habilite nas configurações.",
      };
    }

    case "TICK": {
      if (state.status === "recording") {
        return { ...state, durationSeconds: state.durationSeconds + 1 };
      }
      return state;
    }

    default:
      return state;
  }
}

/**
 * Apply a sequence of events to the state machine starting from initialState.
 */
export function applyEvents(
  events: VoiceInputEvent[],
  initialState: VoiceInputState = initialVoiceInputState,
): VoiceInputState {
  return events.reduce(voiceInputReducer, initialState);
}
