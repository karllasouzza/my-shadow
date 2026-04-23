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

describe("transcribe function", () => {
  beforeEach(resetMocks);

  describe("NOT_READY guard", () => {
    it("returns err with NOT_READY when no Whisper model is loaded", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      const result = await transcribe("/path/to/audio.wav");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_READY");
        expect(result.error.message).toBe("No Whisper model loaded.");
      }
    });
  });

  describe("Successful transcription", () => {
    it("returns ok with TranscriptionResult when transcription succeeds", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

      mockContext = {
        transcribe: () => ({
          stop: () => Promise.resolve(),
          promise: Promise.resolve({
            result: "Hello world",
            language: "en",
            segments: [
              { text: "Hello", t0: 0, t1: 500 },
              { text: " world", t0: 500, t1: 1000 },
            ],
            isAborted: false,
          }),
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

  describe("Language hint", () => {
    it("passes language hint to whisper.rn options", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

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

  describe("Progress callback", () => {
    it("passes onProgress callback to whisper.rn options", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

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

  describe("Abort signal", () => {
    it("returns err with ABORTED when transcription is aborted", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

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
        expect(result.error.message).toBe("Transcription cancelled.");
      }
    });

    it("hooks abortSignal to stop function", async () => {
      const { transcribe } = await import("@/shared/ai/stt/transcribe");

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
      const transcribePromise = transcribe("/valid/audio.wav", {
        abortSignal: abortController.signal,
      });

      setTimeout(() => abortController.abort(), 50);
      await transcribePromise;

      expect(stopCalled).toBe(true);
    });
  });
});
