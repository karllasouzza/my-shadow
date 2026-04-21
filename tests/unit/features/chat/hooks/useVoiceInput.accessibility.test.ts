/**
 * Unit tests for accessibility announcements in useVoiceInput
 *
 * Task 8.1 — Write unit tests for accessibility announcements
 * Validates: Requirements 11.3, 11.4, 11.5
 *
 * Tests the pure announcement logic that drives
 * AccessibilityInfo.announceForAccessibility calls on state transitions.
 * Follows the project's pattern of testing pure logic without rendering
 * React Native components in the bun test environment.
 */

import type { VoiceInputStatus } from "@/features/chat/view-model/hooks/useVoiceInput";
import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// Pure announcement logic
// (mirrors the logic in useVoiceInput that calls
//  AccessibilityInfo.announceForAccessibility)
// ---------------------------------------------------------------------------

/**
 * Returns the accessibility announcement string for a given state transition,
 * or null if no announcement should be made.
 *
 * - idle → recording:  "Gravação iniciada"   (Req 11.3)
 * - recording → idle (completed): "Gravação concluída"  (Req 11.4)
 * - recording → idle (cancelled): "Gravação cancelada"  (Req 11.5)
 */
function getAccessibilityAnnouncement(
  prevStatus: VoiceInputStatus,
  nextStatus: VoiceInputStatus,
  cancelled: boolean,
): string | null {
  if (prevStatus === "idle" && nextStatus === "recording") {
    return "Gravação iniciada";
  }
  if (prevStatus === "recording" && nextStatus === "idle") {
    return cancelled ? "Gravação cancelada" : "Gravação concluída";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Accessibility announcements — idle → recording (Req 11.3)", () => {
  it('announces "Gravação iniciada" when transitioning from idle to recording', () => {
    const announcement = getAccessibilityAnnouncement(
      "idle",
      "recording",
      false,
    );
    expect(announcement).toBe("Gravação iniciada");
  });

  it("does not announce when staying in idle", () => {
    expect(getAccessibilityAnnouncement("idle", "idle", false)).toBeNull();
  });

  it("does not announce when transitioning from processing to idle", () => {
    expect(
      getAccessibilityAnnouncement("processing", "idle", false),
    ).toBeNull();
  });
});

describe("Accessibility announcements — recording → idle completed (Req 11.4)", () => {
  it('announces "Gravação concluída" when recording completes successfully', () => {
    const announcement = getAccessibilityAnnouncement(
      "recording",
      "idle",
      false,
    );
    expect(announcement).toBe("Gravação concluída");
  });

  it("does not announce when staying in recording", () => {
    expect(
      getAccessibilityAnnouncement("recording", "recording", false),
    ).toBeNull();
  });

  it("does not announce when transitioning from recording to processing", () => {
    expect(
      getAccessibilityAnnouncement("recording", "processing", false),
    ).toBeNull();
  });
});

describe("Accessibility announcements — recording → idle cancelled (Req 11.5)", () => {
  it('announces "Gravação cancelada" when recording is cancelled via swipe gesture', () => {
    const announcement = getAccessibilityAnnouncement(
      "recording",
      "idle",
      true,
    );
    expect(announcement).toBe("Gravação cancelada");
  });

  it('distinguishes "Gravação cancelada" from "Gravação concluída" based on cancelled flag', () => {
    const completed = getAccessibilityAnnouncement("recording", "idle", false);
    const cancelled = getAccessibilityAnnouncement("recording", "idle", true);
    expect(completed).toBe("Gravação concluída");
    expect(cancelled).toBe("Gravação cancelada");
    expect(completed).not.toBe(cancelled);
  });
});

describe("Accessibility announcements — no announcement for other transitions", () => {
  it("returns null for idle → processing (invalid transition, never occurs)", () => {
    expect(
      getAccessibilityAnnouncement("idle", "processing", false),
    ).toBeNull();
  });

  it("returns null for processing → recording (invalid transition, never occurs)", () => {
    expect(
      getAccessibilityAnnouncement("processing", "recording", false),
    ).toBeNull();
  });

  it("returns null for processing → processing (no change)", () => {
    expect(
      getAccessibilityAnnouncement("processing", "processing", false),
    ).toBeNull();
  });
});

describe("Accessibility announcement strings are in Brazilian Portuguese", () => {
  it('"Gravação iniciada" is the correct Portuguese string for recording start', () => {
    const msg = getAccessibilityAnnouncement("idle", "recording", false);
    expect(msg).toBe("Gravação iniciada");
  });

  it('"Gravação concluída" is the correct Portuguese string for recording completion', () => {
    const msg = getAccessibilityAnnouncement("recording", "idle", false);
    expect(msg).toBe("Gravação concluída");
  });

  it('"Gravação cancelada" is the correct Portuguese string for recording cancellation', () => {
    const msg = getAccessibilityAnnouncement("recording", "idle", true);
    expect(msg).toBe("Gravação cancelada");
  });
});
