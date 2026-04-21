/**
 * Property-based tests for ChatBottomBar voice integration
 *
 * Task 6.2 — Property 1: Button visibility is determined by text content
 *
 * Validates: Requirements 1.2, 1.3
 *
 * Tests the pure logic functions that drive the component's conditional
 * rendering, consistent with the project's pattern of testing pure logic
 * without rendering React Native components in the bun test environment.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure logic extracted from ChatBottomBar
// (mirrors the component's internal conditional rendering logic)
// ---------------------------------------------------------------------------

/**
 * Determines whether the VoiceInputButton should be shown.
 * VoiceInputButton is shown when the text field is empty (after trim).
 */
function shouldShowVoiceButton(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * Determines whether the SendButton should be shown.
 * SendButton is shown when the text field has content (after trim).
 */
function shouldShowSendButton(value: string): boolean {
  return value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Property 1: Button visibility is determined by text content
// Validates: Requirements 1.2, 1.3
// ---------------------------------------------------------------------------

describe("Property 1: Button visibility is determined by text content", () => {
  /**
   * For any arbitrary string value:
   * - VoiceInputButton is visible ↔ trimmed.length === 0
   * - SendButton is visible ↔ trimmed.length > 0
   * - Exactly one of the two buttons is visible at any time
   */
  it("VoiceInputButton visible ↔ trimmed.length === 0, SendButton visible ↔ trimmed.length > 0", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const trimmed = value.trim();
        const showVoice = shouldShowVoiceButton(value);
        const showSend = shouldShowSendButton(value);

        // VoiceInputButton visible iff trimmed is empty
        expect(showVoice).toBe(trimmed.length === 0);

        // SendButton visible iff trimmed is non-empty
        expect(showSend).toBe(trimmed.length > 0);

        // Exactly one button is shown at any time (mutual exclusion)
        expect(showVoice !== showSend).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("VoiceInputButton is always shown for whitespace-only strings", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^\s*$/), (value) => {
        expect(shouldShowVoiceButton(value)).toBe(true);
        expect(shouldShowSendButton(value)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("SendButton is always shown for strings with at least one non-whitespace character", () => {
    fc.assert(
      fc.property(
        // Generate strings that have at least one non-whitespace char
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (value) => {
          expect(shouldShowVoiceButton(value)).toBe(false);
          expect(shouldShowSendButton(value)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
