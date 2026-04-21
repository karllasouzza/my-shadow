/**
 * Unit tests for shared/ai/stt/transcribe.ts
 *
 * Task 10.1 — Implement transcribe function
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
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

describe("transcribe function", () => {
  beforeEach(resetMocks);

  describe("NOT_READY guard (Requirement 7.3)", () => {
    it("returns err with NOT_READY when no Whisper model is loaded", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = false;

      const result = await transcribe("/path/to/audio.wav");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_READY");
        expect(result.error.message).toBe("Nenhum modelo Whisper carregado.");
      }
    });
  });

  describe("FILE_NOT_FOUND guard (Requirement 7.4)", () => {
    it("returns err with FILE_NOT_FOUND when audio file does not exist", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = true;
      mockContext = {};
      mockFileInfo["/nonexistent/audio.wav"] = { exists: false };

      const result = await transcribe("/nonexistent/audio.wav");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("FILE_NOT_FOUND");
        expect(result.error.message).toBe("Arquivo de áudio não encontrado.");
      }
    });
  });

  describe("Successful transcription (Requirement 7.1)", () => {
    it("returns ok with TranscriptionResult when transcription succeeds", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = true;
      mockFileInfo["/valid/audio.wav"] = { exists: true };

      const mockTranscribeResult = {
        result: "Hello world",
        language: "en",
        segments: [
          { text: "Hello", t0: 0, t1: 500 },
          { text: " world", t0: 500, t1: 1000 },
        ],
        isAborted: false,
      };

      mockContext = {
        transcribe: () => ({
          stop: () => Promise.resolve(),
          promise: Promise.resolve(mockTranscribeResult),
        }),
      };

      const result = await transcribe("/valid/audio.wav");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe("Hello world");
        expect(result.data.language).toBe("en");
        expect(result.data.segments).toHaveLength(2);
        expect(result.data.segments[0].text).toBe("Hello");
        expect(result.data.segments[0].startMs).toBe(0);
        expect(result.data.segments[0].endMs).toBe(500);
      }
    });
  });

  describe("Language hint (Requirement 7.5)", () => {
    it("passes language hint to whisper.rn options", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = true;
      mockFileInfo["/valid/audio.wav"] = { exists: true };

      let capturedOptions: any = null;

      mockContext = {
        transcribe: (_path: string, options: any) => {
          capturedOptions = options;
          return {
            stop: () => Promise.resolve(),
            promise: Promise.resolve({
              result: "Olá mundo",
              language: "pt",
              segments: [],
              isAborted: false,
            }),
          };
        },
      };

      await transcribe("/valid/audio.wav", { language: "pt" });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.language).toBe("pt");
    });
  });

  describe("Progress callback (Requirement 7.6)", () => {
    it("passes onProgress callback to whisper.rn options", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = true;
      mockFileInfo["/valid/audio.wav"] = { exists: true };

      let capturedOptions: any = null;
      const progressCallback = (progress: number) => {
        console.log(`Progress: ${progress}%`);
      };

      mockContext = {
        transcribe: (_path: string, options: any) => {
          capturedOptions = options;
          return {
            stop: () => Promise.resolve(),
            promise: Promise.resolve({
              result: "Test",
              language: "en",
              segments: [],
              isAborted: false,
            }),
          };
        },
      };

      await transcribe("/valid/audio.wav", { onProgress: progressCallback });

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions.onProgress).toBe(progressCallback);
    });
  });

  describe("Abort signal (Requirement 7.2)", () => {
    it("returns err with ABORTED when transcription is aborted", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = true;
      mockFileInfo["/valid/audio.wav"] = { exists: true };

      mockContext = {
        transcribe: () => ({
          stop: () => Promise.resolve(),
          promise: Promise.resolve({
            result: "",
            language: "en",
            segments: [],
            isAborted: true,
          }),
        }),
      };

      const result = await transcribe("/valid/audio.wav");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("ABORTED");
        expect(result.error.message).toBe("Transcrição cancelada.");
      }
    });

    it("hooks abortSignal to stop function", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockIsModelLoaded = true;
      mockFileInfo["/valid/audio.wav"] = { exists: true };

      let stopCalled = false;

      mockContext = {
        transcribe: () => ({
          stop: () => {
            stopCalled = true;
            return Promise.resolve();
          },
          promise: new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                result: "",
                language: "en",
                segments: [],
                isAborted: true,
              });
            }, 100);
          }),
        }),
      };

      const abortController = new AbortController();

      // Start transcription
      const transcribePromise = transcribe("/valid/audio.wav", {
        abortSignal: abortController.signal,
      });

      // Abort after a short delay
      setTimeout(() => abortController.abort(), 50);

      await transcribePromise;

      expect(stopCalled).toBe(true);
    });
  });
});
