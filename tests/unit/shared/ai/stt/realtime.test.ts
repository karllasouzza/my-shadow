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

describe("Realtime Transcription", () => {
  let mockOptions: any;

  beforeEach(async () => {
    resetMocks();
    mockOptions = {
      language: "pt",
      onPartialResult: mock(() => {}),
      onFinalResult: mock(() => {}),
    };

    const { _resetRealtimeState } = await import("@/shared/ai/stt/realtime");
    _resetRealtimeState();
  });

  describe("startRealtimeTranscription guards", () => {
    it("returns ALREADY_ACTIVE error when session is already running", async () => {
      const { startRealtimeTranscription, isRealtimeTranscriptionActive } =
        await import("@/shared/ai/stt/realtime");

      mockContext = {
        transcribeRealtime: async () => ({
          stop: async () => {},
          subscribe: (cb: any) => {
            cb({ data: { result: "test" }, isCapturing: true });
          },
        }),
      };

      const result1 = await startRealtimeTranscription(mockOptions);
      expect(result1.success).toBe(true);
      expect(isRealtimeTranscriptionActive()).toBe(true);

      const result2 = await startRealtimeTranscription(mockOptions);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.code).toBe("ALREADY_ACTIVE");
        expect(result2.error.message).toBe(
          "Realtime transcription already active.",
        );
      }
    });

    it("returns NOT_READY error when no Whisper model is loaded", async () => {
      const { startRealtimeTranscription } = await import(
        "@/shared/ai/stt/realtime"
      );

      const result = await startRealtimeTranscription(mockOptions);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_READY");
        expect(result.error.message).toBe("No Whisper model loaded.");
      }
    });
  });

  describe("startRealtimeTranscription success cases", () => {
    it("successfully starts transcription with transcribeRealtime", async () => {
      const { startRealtimeTranscription, isRealtimeTranscriptionActive } =
        await import("@/shared/ai/stt/realtime");

      mockContext = {
        transcribeRealtime: async () => ({
          stop: async () => {},
          subscribe: (cb: any) => {
            cb({ data: { result: "hello" }, isCapturing: true });
            cb({ data: { result: "hello world" }, isCapturing: false });
          },
        }),
      };

      const onFinalResult = mock(() => {});
      const result = await startRealtimeTranscription({
        ...mockOptions,
        onFinalResult,
      });

      expect(result.success).toBe(true);
      expect(isRealtimeTranscriptionActive()).toBe(false);
      expect(onFinalResult).toHaveBeenCalledWith("hello world");
    });

    it("falls back to transcribe when transcribeRealtime is unavailable", async () => {
      const { startRealtimeTranscription, isRealtimeTranscriptionActive } =
        await import("@/shared/ai/stt/realtime");

      mockContext = {
        transcribe: () => ({
          stop: async () => {},
          promise: Promise.resolve({
            result: "fallback result",
            language: "pt",
          }),
        }),
      };

      const onFinalResult = mock(() => {});
      const result = await startRealtimeTranscription({
        ...mockOptions,
        onFinalResult,
      });

      expect(result.success).toBe(true);
      expect(isRealtimeTranscriptionActive()).toBe(false);
      expect(onFinalResult).toHaveBeenCalledWith("fallback result");
    });
  });

  describe("stopRealtimeTranscription", () => {
    it("returns success when no session is active", async () => {
      const { stopRealtimeTranscription } = await import(
        "@/shared/ai/stt/realtime"
      );

      const result = await stopRealtimeTranscription();
      expect(result.success).toBe(true);
    });

    it("successfully stops active session", async () => {
      const {
        startRealtimeTranscription,
        stopRealtimeTranscription,
        isRealtimeTranscriptionActive,
      } = await import("@/shared/ai/stt/realtime");

      let stopCalled = false;
      mockContext = {
        transcribeRealtime: async () => ({
          stop: async () => {
            stopCalled = true;
          },
          subscribe: () => {},
        }),
      };

      await startRealtimeTranscription(mockOptions);
      expect(isRealtimeTranscriptionActive()).toBe(true);

      const result = await stopRealtimeTranscription();

      expect(result.success).toBe(true);
      expect(isRealtimeTranscriptionActive()).toBe(false);
      expect(stopCalled).toBe(true);
    });

    it("resets state even if stopping fails", async () => {
      const {
        startRealtimeTranscription,
        stopRealtimeTranscription,
        isRealtimeTranscriptionActive,
      } = await import("@/shared/ai/stt/realtime");

      mockContext = {
        transcribeRealtime: async () => ({
          stop: async () => {
            throw new Error("Stop failed");
          },
          subscribe: () => {},
        }),
      };

      await startRealtimeTranscription(mockOptions);
      expect(isRealtimeTranscriptionActive()).toBe(true);

      const result = await stopRealtimeTranscription();

      expect(result.success).toBe(false);
      expect(isRealtimeTranscriptionActive()).toBe(false);
    });
  });

  describe("isRealtimeTranscriptionActive", () => {
    it("returns false when no session is active", async () => {
      const { isRealtimeTranscriptionActive } = await import(
        "@/shared/ai/stt/realtime"
      );

      expect(isRealtimeTranscriptionActive()).toBe(false);
    });

    it("returns true when session is active", async () => {
      const { startRealtimeTranscription, isRealtimeTranscriptionActive } =
        await import("@/shared/ai/stt/realtime");

      mockContext = {
        transcribeRealtime: async () => ({
          stop: async () => {},
          subscribe: () => {},
        }),
      };

      await startRealtimeTranscription(mockOptions);
      expect(isRealtimeTranscriptionActive()).toBe(true);
    });

    it("returns false after session is stopped", async () => {
      const {
        startRealtimeTranscription,
        stopRealtimeTranscription,
        isRealtimeTranscriptionActive,
      } = await import("@/shared/ai/stt/realtime");

      mockContext = {
        transcribeRealtime: async () => ({
          stop: async () => {},
          subscribe: () => {},
        }),
      };

      await startRealtimeTranscription(mockOptions);
      expect(isRealtimeTranscriptionActive()).toBe(true);

      await stopRealtimeTranscription();
      expect(isRealtimeTranscriptionActive()).toBe(false);
    });
  });
});
