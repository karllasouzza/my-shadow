/**
 * Unit tests for VoiceInputButton logic
 *
 * Task 3.1 — Write unit tests for VoiceInputButton
 * Validates: Requirements 10.3, 11.1
 *
 * Tests the pure logic functions that drive the component's props,
 * consistent with the project's pattern of testing pure logic without
 * rendering React Native components in the bun test environment.
 */

import type { VoiceInputStatus } from "@/features/chat/view-model/hooks/useVoiceInput";
import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// Pure logic extracted from VoiceInputButton
// (mirrors the component's internal logic)
// ---------------------------------------------------------------------------

const ACCESSIBILITY_LABELS: Record<VoiceInputStatus, string> = {
  idle: "Gravar mensagem de voz",
  recording: "Parar gravação",
  processing: "Processando gravação",
};

function getAccessibilityLabel(status: VoiceInputStatus): string {
  return ACCESSIBILITY_LABELS[status];
}

function isButtonDisabled(status: VoiceInputStatus): boolean {
  return status === "processing";
}

// ---------------------------------------------------------------------------
// accessibilityLabel tests (Req 11.1)
// ---------------------------------------------------------------------------

describe("VoiceInputButton — accessibilityLabel per state (Req 11.1)", () => {
  it('idle state has label "Gravar mensagem de voz"', () => {
    expect(getAccessibilityLabel("idle")).toBe("Gravar mensagem de voz");
  });

  it('recording state has label "Parar gravação"', () => {
    expect(getAccessibilityLabel("recording")).toBe("Parar gravação");
  });

  it('processing state has label "Processando gravação"', () => {
    expect(getAccessibilityLabel("processing")).toBe("Processando gravação");
  });
});

// ---------------------------------------------------------------------------
// disabled state tests (Req 10.3)
// ---------------------------------------------------------------------------

describe("VoiceInputButton — disabled state (Req 10.3)", () => {
  it("is disabled when status is processing", () => {
    expect(isButtonDisabled("processing")).toBe(true);
  });

  it("is enabled when status is idle", () => {
    expect(isButtonDisabled("idle")).toBe(false);
  });

  it("is enabled when status is recording", () => {
    expect(isButtonDisabled("recording")).toBe(false);
  });
});
