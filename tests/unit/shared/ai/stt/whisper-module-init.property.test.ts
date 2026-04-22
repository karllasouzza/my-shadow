/**
 * Bug Condition Exploration Test for whisper.rn module initialization
 *
 * Property 1: Bug Condition - Native Module Null Safety
 *   Validates: Requirements 2.1, 2.2
 *
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 *
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * GOAL: Surface counterexamples that demonstrate the bug exists
 *
 * NOTE: After fix is applied, this test verifies the expected behavior is satisfied
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Property 1: Bug Condition - Native Module Null Safety
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
describe("Property 1: Bug Condition - Native Module Null Safety", () => {
  it("should verify fix is applied in whisper.rn source code", () => {
    // This test verifies the fix has been applied to the whisper.rn module
    // by checking the source code contains the correct optional chaining pattern

    fc.assert(
      fc.property(
        fc.constant({
          platform: "android",
          nativeModule: null,
          attemptedOperation: "getConstants",
          executionContext: "module-level-initialization",
        }),
        (input) => {
          // Read the whisper.rn source file
          const whisperSourcePath = "node_modules/whisper.rn/src/index.ts";
          const sourceCode = fs.readFileSync(whisperSourcePath, "utf-8");

          // EXPECTED BEHAVIOR (after fix):
          // 1. Source code should contain the FIXED pattern: RNWhisper?.getConstants?.()
          expect(sourceCode).toContain("RNWhisper?.getConstants?.()");

          // 2. Source code should contain the explanatory comment
          expect(sourceCode).toContain(
            "Android initialization timing: RNWhisper may be null",
          );

          // 3. Source code should NOT contain the buggy pattern (without ? on RNWhisper)
          // Note: We check for the specific buggy pattern that was in the original code
          const buggyPattern = /RNWhisper\.getConstants\?\(\)/;
          const hasBuggyPattern = buggyPattern.test(sourceCode);
          expect(hasBuggyPattern).toBe(false);
        },
      ),
      { numRuns: 1 }, // Run once since this is a deterministic check
    );
  });

  it("should handle null RNWhisper with proper optional chaining pattern", () => {
    // Test the FIXED pattern: RNWhisper?.getConstants?.()
    // This demonstrates the expected behavior after the fix

    fc.assert(
      fc.property(fc.constant(null), (RNWhisper) => {
        // Simulate the FIXED code pattern: RNWhisper?.getConstants?.()
        // When RNWhisper is null, this should return undefined, not throw

        let error: Error | null = null;
        let result: any = null;

        try {
          // This is the FIXED pattern
          // @ts-expect-error - Testing null access
          result = RNWhisper?.getConstants?.() || {};
        } catch (e) {
          error = e as Error;
        }

        // EXPECTED BEHAVIOR: No error, returns {}
        expect(error).toBeNull();
        expect(result).toEqual({});
      }),
      { numRuns: 10 },
    );
  });

  it("should demonstrate buggy pattern fails without optional chaining on object", () => {
    // This test demonstrates why the fix was needed
    // The buggy pattern RNWhisper.getConstants?.() fails when RNWhisper is null

    fc.assert(
      fc.property(fc.constant(null), (RNWhisper) => {
        // Simulate the buggy code pattern: RNWhisper.getConstants?.()
        // When RNWhisper is null, this throws TypeError

        let error: Error | null = null;

        try {
          // This is the BUGGY pattern (without ? on RNWhisper)
          // @ts-expect-error - Testing null access
          const result = RNWhisper.getConstants?.() || {};
        } catch (e) {
          error = e as Error;
        }

        // This demonstrates the bug: accessing property on null throws TypeError
        expect(error).not.toBeNull();
        // Error message varies by runtime: "Cannot read" (Node) or "null is not an object" (Bun)
        const hasExpectedError =
          error?.message.includes("Cannot read") ||
          error?.message.includes("null is not an object");
        expect(hasExpectedError).toBe(true);
      }),
      { numRuns: 10 },
    );
  });
});
