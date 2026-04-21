/**
 * Unit tests for shared/ai/stt/vad.ts
 *
 * Task 11.3 — Write unit tests for VAD guards
 * Validates: Requirements 8.2, 8.4
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";

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

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("VAD module", () => {
  beforeEach(resetMocks);

  describe("detectSpeechSegments function", () => {
    describe("NOT_READY guard (Requirement 8.4)", () => {
      it("returns err with NOT_READY when no Whisper model is loaded", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = false;

        const result = await detectSpeechSegments("/path/to/audio.wav");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("NOT_READY");
          expect(result.error.message).toBe("Nenhum modelo Whisper carregado.");
        }
      });
    });

    describe("FILE_NOT_FOUND guard", () => {
      it("returns err with FILE_NOT_FOUND when audio file does not exist", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockContext = {};
        mockFileInfo["/nonexistent/audio.wav"] = { exists: false };

        const result = await detectSpeechSegments("/nonexistent/audio.wav");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("FILE_NOT_FOUND");
          expect(result.error.message).toBe("Arquivo de áudio não encontrado.");
        }
      });
    });

    describe("Empty array on silent audio (Requirement 8.2)", () => {
      it("returns ok([]) when no speech is detected in audio", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/silent/audio.wav"] = { exists: true };

        // Mock silent audio - no segments returned
        const mockTranscribeResult = {
          result: "",
          language: "en",
          segments: [], // Empty segments array indicates no speech
          isAborted: false,
        };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve(mockTranscribeResult),
          }),
        };

        const result = await detectSpeechSegments("/silent/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([]);
        }
      });
    });

    describe("Successful speech detection", () => {
      it("returns ok with SpeechSegment[] when speech is detected", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/speech/audio.wav"] = { exists: true };

        // Mock audio with speech segments
        const mockTranscribeResult = {
          result: "Hello world",
          language: "en",
          segments: [
            { text: "Hello", t0: 0, t1: 500 },
            { text: " world", t0: 1000, t1: 1500 },
          ],
          isAborted: false,
        };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve(mockTranscribeResult),
          }),
        };

        const result = await detectSpeechSegments("/speech/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(2);
          expect(result.data[0].startMs).toBe(0);
          expect(result.data[0].endMs).toBe(500);
          expect(result.data[1].startMs).toBe(1000);
          expect(result.data[1].endMs).toBe(1500);
        }
      });
    });

    describe("Silence threshold filtering", () => {
      it("filters out segments shorter than silenceThresholdMs", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/mixed/audio.wav"] = { exists: true };

        // Mock audio with segments of varying lengths
        const mockTranscribeResult = {
          result: "Hi there",
          language: "en",
          segments: [
            { text: "Hi", t0: 0, t1: 100 }, // 100ms - shorter than default 300ms threshold
            { text: " there", t0: 500, t1: 1000 }, // 500ms - longer than threshold
          ],
          isAborted: false,
        };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve(mockTranscribeResult),
          }),
        };

        const result = await detectSpeechSegments("/mixed/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          // Only the longer segment should be included
          expect(result.data).toHaveLength(1);
          expect(result.data[0].startMs).toBe(500);
          expect(result.data[0].endMs).toBe(1000);
        }
      });

      it("respects custom silenceThresholdMs option", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/custom/audio.wav"] = { exists: true };

        // Mock audio with a 200ms segment
        const mockTranscribeResult = {
          result: "Hi",
          language: "en",
          segments: [
            { text: "Hi", t0: 0, t1: 200 }, // 200ms segment
          ],
          isAborted: false,
        };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve(mockTranscribeResult),
          }),
        };

        // With default 300ms threshold, segment should be filtered out
        const result1 = await detectSpeechSegments("/custom/audio.wav");
        expect(result1.success).toBe(true);
        if (result1.success) {
          expect(result1.data).toHaveLength(0);
        }

        // With custom 100ms threshold, segment should be included
        const result2 = await detectSpeechSegments("/custom/audio.wav", {
          silenceThresholdMs: 100,
        });
        expect(result2.success).toBe(true);
        if (result2.success) {
          expect(result2.data).toHaveLength(1);
          expect(result2.data[0].startMs).toBe(0);
          expect(result2.data[0].endMs).toBe(200);
        }
      });
    });

    describe("Segment merging", () => {
      it("merges adjacent segments separated by less than silenceThresholdMs", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/adjacent/audio.wav"] = { exists: true };

        // Mock audio with adjacent segments separated by 200ms gap (less than 300ms threshold)
        const mockTranscribeResult = {
          result: "Hello world",
          language: "en",
          segments: [
            { text: "Hello", t0: 0, t1: 500 },
            { text: " world", t0: 700, t1: 1200 }, // 200ms gap from previous segment
          ],
          isAborted: false,
        };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve(mockTranscribeResult),
          }),
        };

        const result = await detectSpeechSegments("/adjacent/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          // Segments should be merged into one
          expect(result.data).toHaveLength(1);
          expect(result.data[0].startMs).toBe(0);
          expect(result.data[0].endMs).toBe(1200);
        }
      });

      it("does not merge segments separated by more than silenceThresholdMs", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/separated/audio.wav"] = { exists: true };

        // Mock audio with segments separated by 500ms gap (more than 300ms threshold)
        const mockTranscribeResult = {
          result: "Hello world",
          language: "en",
          segments: [
            { text: "Hello", t0: 0, t1: 500 },
            { text: " world", t0: 1000, t1: 1500 }, // 500ms gap from previous segment
          ],
          isAborted: false,
        };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve(mockTranscribeResult),
          }),
        };

        const result = await detectSpeechSegments("/separated/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          // Segments should remain separate
          expect(result.data).toHaveLength(2);
          expect(result.data[0].startMs).toBe(0);
          expect(result.data[0].endMs).toBe(500);
          expect(result.data[1].startMs).toBe(1000);
          expect(result.data[1].endMs).toBe(1500);
        }
      });
    });

    describe("Error handling", () => {
      it("returns err with ABORTED when transcription is aborted", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockIsModelLoaded = true;
        mockFileInfo["/valid/audio.wav"] = { exists: true };

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve({
              result: "",
              language: "en",
              segments: [],
              isAborted: true,
            }),
          }),
        };

        const result = await detectSpeechSegments("/valid/audio.wav");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("ABORTED");
          expect(result.error.message).toBe("Detecção de fala cancelada.");
        }
      });
    });
  });

  describe("isSpeaking function", () => {
    it("returns true for audio chunk with high energy", () => {
      const { isSpeaking } = require("@/shared/ai/stt/vad");

      // Create audio chunk with high energy (speech-like)
      const audioChunk = new Float32Array(1024);
      for (let i = 0; i < audioChunk.length; i++) {
        audioChunk[i] = Math.sin(i * 0.1) * 0.5; // High amplitude sine wave
      }

      const result = isSpeaking(audioChunk);
      expect(result).toBe(true);
    });

    it("returns false for audio chunk with low energy", () => {
      const { isSpeaking } = require("@/shared/ai/stt/vad");

      // Create audio chunk with low energy (silence-like)
      const audioChunk = new Float32Array(1024);
      for (let i = 0; i < audioChunk.length; i++) {
        audioChunk[i] = Math.random() * 0.001; // Very low amplitude noise
      }

      const result = isSpeaking(audioChunk);
      expect(result).toBe(false);
    });

    it("returns false for completely silent audio chunk", () => {
      const { isSpeaking } = require("@/shared/ai/stt/vad");

      // Create completely silent audio chunk
      const audioChunk = new Float32Array(1024); // All zeros by default

      const result = isSpeaking(audioChunk);
      expect(result).toBe(false);
    });
  });
});
