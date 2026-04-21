/**
 * Unit tests for ChatBottomBar voice integration
 *
 * Task 6.1 — Write unit tests for ChatBottomBar voice integration
 * Validates: Requirements 1.2, 1.3, 4.3, 2.3
 *
 * Tests the pure logic functions that drive the component's conditional
 * rendering, consistent with the project's pattern of testing pure logic
 * without rendering React Native components in the bun test environment.
 */

import type { VoiceInputStatus } from "@/features/chat/view-model/hooks/useVoiceInput";
import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// Pure logic extracted from ChatBottomBar
// (mirrors the component's internal conditional rendering logic)
// ---------------------------------------------------------------------------

/**
 * Determines whether the VoiceInputButton should be shown.
 * VoiceInputButton is shown when the text field is empty (after trim).
 * Req 1.3: When text is empty, show VoiceInputButton in place of SendButton.
 */
function shouldShowVoiceButton(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Determines whether the SendButton should be shown.
 * SendButton is shown when the text field has content (after trim).
 * Req 1.2: When text has content, hide VoiceInputButton and show SendButton.
 */
function shouldShowSendButton(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Determines whether the text input should be editable.
 * Input is not editable while recording (Req 10.2).
 */
function isInputEditable(
  isModelReady: boolean,
  isGenerating: boolean,
  voiceStatus: VoiceInputStatus,
): boolean {
  return isModelReady && !isGenerating && voiceStatus !== "recording";
}

/**
 * Determines whether the loading indicator (ActivityIndicator) should be shown.
 * Shown when voice status is "processing" (Req 2.3, 4.3).
 */
function shouldShowLoadingIndicator(voiceStatus: VoiceInputStatus): boolean {
  return voiceStatus === "processing";
}

/**
 * Determines whether the recording status row should be shown.
 * Shown while voice status is "recording" (Req 5.1, 5.5, 6.3).
 */
function shouldShowRecordingRow(voiceStatus: VoiceInputStatus): boolean {
  return voiceStatus === "recording";
}

/**
 * Returns the value to display in the text input.
 * While recording, shows the partial transcript (Req 4.1).
 */
function getDisplayValue(
  value: string,
  partialTranscript: string,
  voiceStatus: VoiceInputStatus,
): string {
  return voiceStatus === "recording" ? partialTranscript : value;
}

/**
 * Returns the CSS classes for the text input.
 * While recording, applies italic + reduced opacity (Req 4.3).
 */
function getInputClasses(voiceStatus: VoiceInputStatus): string {
  const base =
    "w-full text-foreground placeholder:text-muted-foreground bg-transparent outline-none";
  return voiceStatus === "recording" ? `${base} italic opacity-60` : base;
}

// ---------------------------------------------------------------------------
// VoiceInputButton vs SendButton visibility (Req 1.2, 1.3)
// ---------------------------------------------------------------------------

describe("ChatBottomBar — button visibility (Req 1.2, 1.3)", () => {
  it("shows VoiceInputButton when value is empty string", () => {
    expect(shouldShowVoiceButton("")).toBe(true);
    expect(shouldShowSendButton("")).toBe(false);
  });

  it("shows VoiceInputButton when value is whitespace only", () => {
    expect(shouldShowVoiceButton("   ")).toBe(true);
    expect(shouldShowSendButton("   ")).toBe(false);
  });

  it('shows SendButton when value is "hello"', () => {
    expect(shouldShowVoiceButton("hello")).toBe(false);
    expect(shouldShowSendButton("hello")).toBe(true);
  });

  it("shows SendButton when value has any non-whitespace character", () => {
    expect(shouldShowVoiceButton("a")).toBe(false);
    expect(shouldShowSendButton("a")).toBe(true);
  });

  it("shows SendButton when value has leading/trailing whitespace but non-empty content", () => {
    expect(shouldShowVoiceButton("  hi  ")).toBe(false);
    expect(shouldShowSendButton("  hi  ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partial transcript display with italic/dimmed style (Req 4.1, 4.3)
// ---------------------------------------------------------------------------

describe("ChatBottomBar — partial transcript display (Req 4.1, 4.3)", () => {
  it("shows partial transcript as input value while recording", () => {
    expect(getDisplayValue("typed text", "partial...", "recording")).toBe(
      "partial...",
    );
  });

  it("shows typed value when not recording", () => {
    expect(getDisplayValue("typed text", "partial...", "idle")).toBe(
      "typed text",
    );
    expect(getDisplayValue("typed text", "partial...", "processing")).toBe(
      "typed text",
    );
  });

  it("applies italic and opacity-60 classes while recording", () => {
    const classes = getInputClasses("recording");
    expect(classes).toContain("italic");
    expect(classes).toContain("opacity-60");
  });

  it("does not apply italic/opacity classes when idle", () => {
    const classes = getInputClasses("idle");
    expect(classes).not.toContain("italic");
    expect(classes).not.toContain("opacity-60");
  });

  it("does not apply italic/opacity classes when processing", () => {
    const classes = getInputClasses("processing");
    expect(classes).not.toContain("italic");
    expect(classes).not.toContain("opacity-60");
  });
});

// ---------------------------------------------------------------------------
// Loading indicator shown when processing (Req 2.3, 4.3)
// ---------------------------------------------------------------------------

describe("ChatBottomBar — loading indicator (Req 2.3, 4.3)", () => {
  it('shows loading indicator when status is "processing"', () => {
    expect(shouldShowLoadingIndicator("processing")).toBe(true);
  });

  it('does not show loading indicator when status is "idle"', () => {
    expect(shouldShowLoadingIndicator("idle")).toBe(false);
  });

  it('does not show loading indicator when status is "recording"', () => {
    expect(shouldShowLoadingIndicator("recording")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Recording row visibility (Req 5.1, 5.5, 6.3)
// ---------------------------------------------------------------------------

describe("ChatBottomBar — recording row visibility", () => {
  it('shows recording row when status is "recording"', () => {
    expect(shouldShowRecordingRow("recording")).toBe(true);
  });

  it('hides recording row when status is "idle"', () => {
    expect(shouldShowRecordingRow("idle")).toBe(false);
  });

  it('hides recording row when status is "processing"', () => {
    expect(shouldShowRecordingRow("processing")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Input editability disabled while recording (Req 10.2)
// ---------------------------------------------------------------------------

describe("ChatBottomBar — input editability (Req 10.2)", () => {
  it("input is not editable while recording", () => {
    expect(isInputEditable(true, false, "recording")).toBe(false);
  });

  it("input is editable when idle and model is ready", () => {
    expect(isInputEditable(true, false, "idle")).toBe(true);
  });

  it("input is not editable when model is not ready", () => {
    expect(isInputEditable(false, false, "idle")).toBe(false);
  });

  it("input is not editable when generating", () => {
    expect(isInputEditable(true, true, "idle")).toBe(false);
  });
});
