/**
 * Property-based tests for shared/ai/stt/vad.ts
 *
 * Property 6 — VAD empty-audio safety
 *   Validates: Requirements 8.2
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

mock.module("react-native", () => ({
  Platform: { OS: "test" },
  NativeModules: {},
}));

// Mock getActiveContext
let mockContext: any = null;

mock.module("@/shared/ai/stt/runtime", () => ({
  getActiveContext: () => {
    if (!mockContext) {
      return {
        success: false,
        error: { code: "NOT_READY", message: "No Whisper model loaded." },
      };
    }
    return { success: true, data: mockContext };
  },
}));

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function resetMocks() {
  mockContext = null;
}

function setupSilentAudioContext() {
  mockContext = {
    transcribe: () => ({
      promise: Promise.resolve({
        result: "",
        language: "en",
        segments: [],
        isAborted: false,
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Property 6 — VAD empty-audio safety
// ---------------------------------------------------------------------------
describe("Property 6: VAD empty-audio safety", () => {
  beforeEach(resetMocks);

  it("returns ok([]) for silent audio files", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .map((s) => `/test/audio/${s}.wav`),
        fc.option(
          fc.record({
            silenceThresholdMs: fc.integer({ min: 50, max: 2000 }),
          }),
          { nil: undefined },
        ),
        async (audioPath, options) => {
          setupSilentAudioContext();

          const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");
          const result = await detectSpeechSegments(audioPath, options);

          expect(result.success).toBe(true);
          if (result.success) {
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data).toEqual([]);
            expect(result.data.length).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("filters out all short segments resulting in empty array", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .map((s) => `/test/audio/${s}.wav`),
        fc.integer({ min: 100, max: 1000 }),
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 10 }),
            t0: fc.integer({ min: 0, max: 100 }),
            t1: fc.integer({ min: 0, max: 50 }),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        async (audioPath, silenceThresholdMs, shortSegments) => {
          mockContext = {
            transcribe: () => ({
              promise: Promise.resolve({
                result: "",
                language: "en",
                segments: shortSegments,
                isAborted: false,
              }),
            }),
          };

          const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");
          const result = await detectSpeechSegments(audioPath, {
            silenceThresholdMs,
          });

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual([]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("empty segments array always produces empty result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .map((s) => `/test/audio/${s}.wav`),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 2, maxLength: 5 }),
        fc.integer({ min: 50, max: 2000 }),
        async (audioPath, resultText, language, silenceThresholdMs) => {
          mockContext = {
            transcribe: () => ({
              promise: Promise.resolve({
                result: resultText,
                language: language,
                segments: [],
                isAborted: false,
              }),
            }),
          };

          const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");
          const result = await detectSpeechSegments(audioPath, {
            silenceThresholdMs,
          });

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual([]);
            expect(result.data.length).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
