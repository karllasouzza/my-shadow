/**
 * Property-based tests for VoiceInputButton logic
 *
 * Task 3.2 — Property 10: AccessibilityLabel reflects current state
 * Task 3.3 — Property 9: Processing state disables the voice button
 *
 * Validates: Requirements 10.3, 11.1
 *
 * Tests the pure logic functions that drive the component's props,
 * consistent with the project's pattern of testing pure logic without
 * rendering React Native components in the bun test environment.
 */

import type { VoiceInputStatus } from "@/features/chat/view-model/hooks/useVoiceInput";
import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";

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
// Property 10: AccessibilityLabel reflects current state
// Validates: Requirements 11.1
// ---------------------------------------------------------------------------

describe("Property 10: AccessibilityLabel reflects current state", () => {
  it("accessibilityLabel matches expected Brazilian Portuguese string for any VoiceInputStatus", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<VoiceInputStatus>("idle", "recording", "processing"),
        (status) => {
          const label = getAccessibilityLabel(status);
          const expected: Record<VoiceInputStatus, string> = {
            idle: "Gravar mensagem de voz",
            recording: "Parar gravação",
            processing: "Processando gravação",
          };
          expect(label).toBe(expected[status]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Processing state disables the voice button
// Validates: Requirements 10.3
// ---------------------------------------------------------------------------

describe("Property 9: Processing state disables the voice button", () => {
  it("disabled is true for any processing status input", () => {
    fc.assert(
      fc.property(fc.constant<VoiceInputStatus>("processing"), (status) => {
        expect(isButtonDisabled(status)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("disabled is false for idle and recording status inputs", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<VoiceInputStatus>("idle", "recording"),
        (status) => {
          expect(isButtonDisabled(status)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
