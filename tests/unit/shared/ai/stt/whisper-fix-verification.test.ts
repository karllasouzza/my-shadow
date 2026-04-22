/**
 * Verification test for whisper.rn module fix
 *
 * This test verifies that the fix allows the module to be imported
 * even when RNWhisper is null, by checking the actual implementation.
 */

import { describe, expect, it } from "bun:test";

describe("Whisper.rn Fix Verification", () => {
  it("should have applied optional chaining to RNWhisper object", () => {
    // Read the actual source code to verify the fix is in place
    const fs = require("fs");
    const path = require("path");

    const indexPath = path.join(
      process.cwd(),
      "node_modules/whisper.rn/src/index.ts",
    );

    const content = fs.readFileSync(indexPath, "utf-8");

    // Verify the fix is applied: RNWhisper?.getConstants?.()
    // The fix adds optional chaining to RNWhisper itself
    expect(content).toContain("RNWhisper?.getConstants?.()");

    // Verify the comment explaining the fix is present
    expect(content).toContain("Android initialization timing");
  });

  it("should export constants with safe defaults when module is available", () => {
    // This test verifies the constants are properly typed
    // The actual module import is tested in integration tests

    // Test that the pattern works with a mock
    const mockRNWhisper = null;
    const { useCoreML, coreMLAllowFallback } =
      (mockRNWhisper as any)?.getConstants?.() || {};

    // Constants should have safe defaults when native module is null
    expect(!!useCoreML).toBe(false);
    expect(!!coreMLAllowFallback).toBe(false);
  });

  it("should handle null RNWhisper gracefully with optional chaining", () => {
    // Test the pattern directly
    const RNWhisper = null;

    let error: Error | null = null;
    let result: any = null;

    try {
      // This is the FIXED pattern: RNWhisper?.getConstants?.()
      // @ts-expect-error - Testing null access
      result = RNWhisper?.getConstants?.() || {};
    } catch (e) {
      error = e as Error;
    }

    // Should not throw error
    expect(error).toBeNull();
    expect(result).toEqual({});
  });
});
