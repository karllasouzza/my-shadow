/**
 * Unit tests for features/chat/utils/format-duration.ts
 *
 * Task 1.1 — Write unit tests for formatDuration
 * Validates: Requirements 5.5
 */

import { formatDuration } from "@/features/chat/utils/format-duration";
import { describe, expect, it } from "bun:test";

describe("formatDuration", () => {
  it('formats 0 seconds as "0:00"', () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it('formats 65 seconds as "1:05"', () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  it('formats 3600 seconds as "60:00"', () => {
    expect(formatDuration(3600)).toBe("60:00");
  });

  it('formats 59 seconds as "0:59"', () => {
    expect(formatDuration(59)).toBe("0:59");
  });

  it('formats 60 seconds as "1:00"', () => {
    expect(formatDuration(60)).toBe("1:00");
  });
});
