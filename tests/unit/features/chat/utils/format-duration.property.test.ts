/**
 * Property-based tests for features/chat/utils/format-duration.ts
 *
 * Property 11: Duration label format is correct for all durations
 * Validates: Requirements 5.5
 */

import { formatDuration } from "@/features/chat/utils/format-duration";
import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";

describe("Property 11: Duration label format is correct for all durations", () => {
  it("formatDuration(n) always matches /^\\d+:[0-5]\\d$/", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3600 }), (n) => {
        const result = formatDuration(n);
        expect(result).toMatch(/^\d+:[0-5]\d$/);
      }),
      { numRuns: 100 },
    );
  });

  it('formatDuration(m * 60 + s) produces "M:SS" correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 59 }),
        (m, s) => {
          const totalSeconds = m * 60 + s;
          if (totalSeconds > 3600) return; // stay within range
          const result = formatDuration(totalSeconds);
          const expected = `${m}:${String(s).padStart(2, "0")}`;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
