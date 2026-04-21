/**
 * Property-based tests for shared/ai/stt/vad.ts
 *
 * Property 6 — VAD empty-audio safety (task 11.4)
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

// Mock FileSystem
const mockFileInfo: Record<string, { exists: boolean }> = {};

mock.module("expo-file-system/legacy", () => ({
  getInfoAsync: async (path: string) => {
    return mockFileInfo[path] || { exists: false };
  },
}));

// Mock WhisperRuntime
let mockIsModelLoaded = false;
let mockContext: any = null;

mock.module("@/shared/ai/stt/runtime", () => ({
  getWhisperRuntime: () => ({
    isModelLoaded: () => mockIsModelLoaded,
    getContext: () => mockContext,
  }),
}));

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function resetMocks() {
  mockIsModelLoaded = false;
  mockContext = null;
  Object.keys(mockFileInfo).forEach((key) => delete mockFileInfo[key]);
}

function setupSilentAudioContext() {
  mockIsModelLoaded = true;
  mockContext = {
    transcribe: () => ({
      promise: Promise.resolve({
        result: "",
        language: "en",
        segments: [], // Empty segments array indicates no speech
        isAborted: false,
      }),
    }),
  };
}

function setupAudioFileExists(path: string) {
  mockFileInfo[path] = { exists: true };
}

// ---------------------------------------------------------------------------
// Property 6 — VAD empty-audio safety
// Validates: Requirements 8.2
// Feature: ai-model-manager-stt, Property 6: VAD empty-audio safety
// ---------------------------------------------------------------------------
describe("Property 6: VAD empty-audio safety", () => {
  beforeEach(resetMocks);

  it("**Validates: Requirements 8.2** - returns ok([]) for silent audio files", async () => {
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
          // Setup: Mock a silent audio file (no speech segments)
          setupAudioFileExists(audioPath);
          setupSilentAudioContext();

          // Import the actual function to test
          const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

          // Execute: Call detectSpeechSegments with silent audio
          const result = await detectSpeechSegments(audioPath, options);

          // Assert: Should return ok([]) for silent audio
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

  it("**Validates: Requirements 8.2** - filters out all short segments resulting in empty array", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .map((s) => `/test/audio/${s}.wav`),
        fc.integer({ min: 100, max: 1000 }), // Silence threshold
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 10 }),
            t0: fc.integer({ min: 0, max: 100 }),
            t1: fc.integer({ min: 0, max: 50 }), // Very short segments (< 50ms)
          }),
          { minLength: 0, maxLength: 5 },
        ),
        async (audioPath, silenceThresholdMs, shortSegments) => {
          // Setup: Mock audio file with only short segments (below threshold)
          setupAudioFileExists(audioPath);
          mockIsModelLoaded = true;
          mockContext = {
            transcribe: () => ({
              promise: Promise.resolve({
                result: "",
                language: "en",
                segments: shortSegments, // All segments are too short
                isAborted: false,
              }),
            }),
          };

          // Import the actual function to test
          const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

          // Execute: Call with short segments
          const result = await detectSpeechSegments(audioPath, {
            silenceThresholdMs,
          });

          // Assert: All segments should be filtered out
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual([]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("**Validates: Requirements 8.2** - empty segments array always produces empty result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .map((s) => `/test/audio/${s}.wav`),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 2, maxLength: 5 }),
        fc.integer({ min: 50, max: 2000 }),
        async (audioPath, resultText, language, silenceThresholdMs) => {
          // Setup: Mock audio file with empty segments (silent audio)
          setupAudioFileExists(audioPath);
          mockIsModelLoaded = true;
          mockContext = {
            transcribe: () => ({
              promise: Promise.resolve({
                result: resultText, // Text doesn't matter for VAD
                language: language,
                segments: [], // Always empty - no speech detected
                isAborted: false,
              }),
            }),
          };

          // Import the actual function to test
          const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

          // Execute: Call with empty segments
          const result = await detectSpeechSegments(audioPath, {
            silenceThresholdMs,
          });

          // Assert: Should always return empty array regardless of other parameters
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
