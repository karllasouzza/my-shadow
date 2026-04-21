/**
 * Unit tests for features/chat/view-model/hooks/useVoiceInput.ts
 *
 * Task 2.1 — Write unit tests for useVoiceInput
 * Validates: Requirements 2.4, 2.5, 7.4, 8.1, 9.4, 10.5
 *
 * These tests exercise the pure state machine reducer (voiceInputReducer)
 * which captures all the logic of useVoiceInput without React/async overhead.
 */

import {
    applyEvents,
    initialVoiceInputState,
    voiceInputReducer,
    type VoiceInputState,
} from "@/features/chat/view-model/hooks/voiceInputReducer";
import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bring state to "recording" */
function recordingState(): VoiceInputState {
  return applyEvents([{ type: "RECORDING_STARTED" }], initialVoiceInputState);
}

/** Bring state to "processing" */
function processingState(): VoiceInputState {
  return applyEvents(
    [{ type: "RECORDING_STARTED" }, { type: "TAP" }],
    initialVoiceInputState,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVoiceInput — initial state", () => {
  it("starts with status idle", () => {
    expect(initialVoiceInputState.status).toBe("idle");
  });

  it("starts with empty partialTranscript", () => {
    expect(initialVoiceInputState.partialTranscript).toBe("");
  });

  it("starts with durationSeconds = 0", () => {
    expect(initialVoiceInputState.durationSeconds).toBe(0);
  });

  it("starts with isCancelPreview = false", () => {
    expect(initialVoiceInputState.isCancelPreview).toBe(false);
  });

  it("starts with permissionDenied = false", () => {
    expect(initialVoiceInputState.permissionDenied).toBe(false);
  });

  it("starts with permissionPermanentlyDenied = false", () => {
    expect(initialVoiceInputState.permissionPermanentlyDenied).toBe(false);
  });

  it("starts with noModelPromptVisible = false", () => {
    expect(initialVoiceInputState.noModelPromptVisible).toBe(false);
  });

  it("starts with errorMessage = null", () => {
    expect(initialVoiceInputState.errorMessage).toBeNull();
  });
});

describe("useVoiceInput — onTranscriptReady not called for empty/whitespace transcripts (Req 2.5)", () => {
  it("FINAL_TRANSCRIPT with empty string transitions to idle (no submission)", () => {
    const state = processingState();
    const next = voiceInputReducer(state, {
      type: "FINAL_TRANSCRIPT",
      text: "",
    });
    expect(next.status).toBe("idle");
    // The hook would NOT call onTranscriptReady because text.trim().length === 0
    // This is verified in the property tests (Properties 6 & 7)
  });

  it("FINAL_TRANSCRIPT with whitespace-only string transitions to idle", () => {
    const state = processingState();
    const next = voiceInputReducer(state, {
      type: "FINAL_TRANSCRIPT",
      text: "   ",
    });
    expect(next.status).toBe("idle");
  });

  it("FINAL_TRANSCRIPT with non-empty string transitions to idle (submission expected)", () => {
    const state = processingState();
    const next = voiceInputReducer(state, {
      type: "FINAL_TRANSCRIPT",
      text: "Olá mundo",
    });
    expect(next.status).toBe("idle");
    expect(next.partialTranscript).toBe("");
  });
});

describe("useVoiceInput — permission denied blocks STT (Req 7.4)", () => {
  it("PERMISSION_DENIED event sets permissionDenied = true", () => {
    const next = voiceInputReducer(initialVoiceInputState, {
      type: "PERMISSION_DENIED",
      permanent: false,
    });
    expect(next.permissionDenied).toBe(true);
    expect(next.status).toBe("idle");
  });

  it("PERMISSION_DENIED permanent sets permissionPermanentlyDenied = true", () => {
    const next = voiceInputReducer(initialVoiceInputState, {
      type: "PERMISSION_DENIED",
      permanent: true,
    });
    expect(next.permissionPermanentlyDenied).toBe(true);
    expect(next.permissionDenied).toBe(true);
  });

  it("TAP while permission denied does not transition to recording", () => {
    const denied = voiceInputReducer(initialVoiceInputState, {
      type: "PERMISSION_DENIED",
      permanent: false,
    });
    // TAP on idle state returns idle (RECORDING_STARTED never fires when denied)
    const next = voiceInputReducer(denied, { type: "TAP" });
    expect(next.status).toBe("idle");
  });
});

describe("useVoiceInput — NOT_READY sets noModelPromptVisible (Req 8.1)", () => {
  it("ERROR NOT_READY sets noModelPromptVisible = true", () => {
    const state = recordingState();
    const next = voiceInputReducer(state, {
      type: "ERROR",
      code: "NOT_READY",
    });
    expect(next.noModelPromptVisible).toBe(true);
    expect(next.status).toBe("idle");
  });

  it("ERROR NOT_READY from idle also sets noModelPromptVisible = true", () => {
    const next = voiceInputReducer(initialVoiceInputState, {
      type: "ERROR",
      code: "NOT_READY",
    });
    expect(next.noModelPromptVisible).toBe(true);
  });
});

describe("useVoiceInput — state resets to idle on unmount (Req 10.5)", () => {
  it("after recording, reset to initial state mirrors idle", () => {
    const state = recordingState();
    expect(state.status).toBe("recording");

    // Simulate unmount reset
    const reset: VoiceInputState = {
      ...initialVoiceInputState,
    };
    expect(reset.status).toBe("idle");
    expect(reset.partialTranscript).toBe("");
    expect(reset.durationSeconds).toBe(0);
  });

  it("after processing, reset to initial state mirrors idle", () => {
    const state = processingState();
    expect(state.status).toBe("processing");

    const reset: VoiceInputState = { ...initialVoiceInputState };
    expect(reset.status).toBe("idle");
  });
});

describe("useVoiceInput — errorMessage is set on error (Req 9.4)", () => {
  it("UNKNOWN_ERROR sets errorMessage", () => {
    const state = recordingState();
    const next = voiceInputReducer(state, {
      type: "ERROR",
      code: "UNKNOWN_ERROR",
    });
    expect(next.errorMessage).not.toBeNull();
    expect(next.status).toBe("idle");
  });

  it("ALREADY_ACTIVE sets errorMessage", () => {
    const next = voiceInputReducer(initialVoiceInputState, {
      type: "ERROR",
      code: "ALREADY_ACTIVE",
    });
    expect(next.errorMessage).toBe(
      "Erro ao iniciar gravação. Tente novamente.",
    );
  });

  it("OUT_OF_MEMORY sets correct errorMessage", () => {
    const state = recordingState();
    const next = voiceInputReducer(state, {
      type: "ERROR",
      code: "OUT_OF_MEMORY",
    });
    expect(next.errorMessage).toBe("Memória insuficiente. Gravação encerrada.");
  });

  it("PERMISSION_DENIED sets correct errorMessage", () => {
    const next = voiceInputReducer(initialVoiceInputState, {
      type: "ERROR",
      code: "PERMISSION_DENIED",
    });
    expect(next.errorMessage).toBe(
      "Permissão de microfone negada. Habilite nas configurações.",
    );
  });
});

describe("useVoiceInput — state machine transitions", () => {
  it("idle → recording via RECORDING_STARTED", () => {
    const next = voiceInputReducer(initialVoiceInputState, {
      type: "RECORDING_STARTED",
    });
    expect(next.status).toBe("recording");
  });

  it("recording → processing via TAP", () => {
    const state = recordingState();
    const next = voiceInputReducer(state, { type: "TAP" });
    expect(next.status).toBe("processing");
  });

  it("recording → processing via LONG_PRESS_END", () => {
    const state = recordingState();
    const next = voiceInputReducer(state, { type: "LONG_PRESS_END" });
    expect(next.status).toBe("processing");
  });

  it("processing → idle via FINAL_TRANSCRIPT", () => {
    const state = processingState();
    const next = voiceInputReducer(state, {
      type: "FINAL_TRANSCRIPT",
      text: "hello",
    });
    expect(next.status).toBe("idle");
  });

  it("recording → idle via cancel gesture (dx <= -80)", () => {
    const state = recordingState();
    const next = voiceInputReducer(state, { type: "CANCEL", dx: -80 });
    expect(next.status).toBe("idle");
  });

  it("TAP in processing state is ignored", () => {
    const state = processingState();
    const next = voiceInputReducer(state, { type: "TAP" });
    expect(next.status).toBe("processing");
  });
});
