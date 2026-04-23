import { beforeEach, describe, expect, it, mock } from "bun:test";

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

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("VAD module", () => {
  beforeEach(resetMocks);

  describe("detectSpeechSegments function", () => {
    describe("NOT_READY guard", () => {
      it("returns err with NOT_READY when no Whisper model is loaded", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        const result = await detectSpeechSegments("/path/to/audio.wav");

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("NOT_READY");
          expect(result.error.message).toBe("No Whisper model loaded.");
        }
      });
    });

    describe("Empty array on silent audio", () => {
      it("returns ok([]) when no speech is detected in audio", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

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

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve({
              result: "Hello world",
              language: "en",
              segments: [
                { text: "Hello", t0: 0, t1: 500 },
                { text: " world", t0: 1000, t1: 1500 },
              ],
              isAborted: false,
            }),
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

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve({
              result: "Hi there",
              language: "en",
              segments: [
                { text: "Hi", t0: 0, t1: 100 },
                { text: " there", t0: 500, t1: 1000 },
              ],
              isAborted: false,
            }),
          }),
        };

        const result = await detectSpeechSegments("/mixed/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].startMs).toBe(500);
          expect(result.data[0].endMs).toBe(1000);
        }
      });

      it("respects custom silenceThresholdMs option", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve({
              result: "Hi",
              language: "en",
              segments: [{ text: "Hi", t0: 0, t1: 200 }],
              isAborted: false,
            }),
          }),
        };

        const result1 = await detectSpeechSegments("/custom/audio.wav");
        expect(result1.success).toBe(true);
        if (result1.success) {
          expect(result1.data).toHaveLength(0);
        }

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

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve({
              result: "Hello world",
              language: "en",
              segments: [
                { text: "Hello", t0: 0, t1: 500 },
                { text: " world", t0: 700, t1: 1200 },
              ],
              isAborted: false,
            }),
          }),
        };

        const result = await detectSpeechSegments("/adjacent/audio.wav");

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toHaveLength(1);
          expect(result.data[0].startMs).toBe(0);
          expect(result.data[0].endMs).toBe(1200);
        }
      });

      it("does not merge segments separated by more than silenceThresholdMs", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

        mockContext = {
          transcribe: () => ({
            promise: Promise.resolve({
              result: "Hello world",
              language: "en",
              segments: [
                { text: "Hello", t0: 0, t1: 500 },
                { text: " world", t0: 1000, t1: 1500 },
              ],
              isAborted: false,
            }),
          }),
        };

        const result = await detectSpeechSegments("/separated/audio.wav");

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

    describe("Error handling", () => {
      it("returns err with ABORTED when transcription is aborted", async () => {
        const { detectSpeechSegments } = await import("@/shared/ai/stt/vad");

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
          expect(result.error.message).toBe("Speech detection cancelled.");
        }
      });
    });
  });

  describe("isSpeaking function", () => {
    it("returns true for audio chunk with high energy", () => {
      const { isSpeaking } = require("@/shared/ai/stt/vad");

      const audioChunk = new Float32Array(1024);
      for (let i = 0; i < audioChunk.length; i++) {
        audioChunk[i] = Math.sin(i * 0.1) * 0.5;
      }

      expect(isSpeaking(audioChunk)).toBe(true);
    });

    it("returns false for audio chunk with low energy", () => {
      const { isSpeaking } = require("@/shared/ai/stt/vad");

      const audioChunk = new Float32Array(1024);
      for (let i = 0; i < audioChunk.length; i++) {
        audioChunk[i] = Math.random() * 0.001;
      }

      expect(isSpeaking(audioChunk)).toBe(false);
    });

    it("returns false for completely silent audio chunk", () => {
      const { isSpeaking } = require("@/shared/ai/stt/vad");

      const audioChunk = new Float32Array(1024);

      expect(isSpeaking(audioChunk)).toBe(false);
    });
  });
});
