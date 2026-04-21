/**
 * Property-based tests for shared/ai/stt/realtime.ts
 *
 * Property 8 — Realtime throttle (task 12.4)
 *   Validates: Requirements 9.3
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

mock.module("react-native", () => ({
  Platform: { OS: "test" },
  NativeModules: {},
}));

mock.module("whisper.rn", () => ({
  initWhisper: mock(() =>
    Promise.resolve({
      transcribe: mock(() => ({
        promise: Promise.resolve({
          result: "test",
          language: "pt",
          segments: [],
        }),
      })),
      release: mock(() => Promise.resolve()),
    }),
  ),
}));

// Mock WhisperRuntime — model always loaded
mock.module("@/shared/ai/stt/runtime", () => ({
  getWhisperRuntime: () => ({
    isModelLoaded: () => true,
    getContext: () => ({
      transcribe: () => ({
        promise: Promise.resolve({ result: "partial text", language: "pt" }),
      }),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Mocked clock helpers
// ---------------------------------------------------------------------------

/**
 * Simulate a realtime session of `durationMs` milliseconds using a fake clock.
 * The interval fires every 500 ms (matching the implementation's polling rate).
 * Returns the number of times `onPartialResult` was called.
 */
async function simulateSession(durationMs: number): Promise<number> {
  let partialCallCount = 0;
  let fakeNow = 0;

  // Patch Date.now to use our fake clock
  const originalDateNow = Date.now;
  Date.now = () => fakeNow;

  // Patch setInterval / clearInterval to use our fake clock
  const intervals: Map<
    number,
    { callback: () => void; ms: number; next: number }
  > = new Map();
  let nextIntervalId = 1000;

  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  (globalThis as any).setInterval = (callback: () => void, ms: number) => {
    const id = nextIntervalId++;
    intervals.set(id, { callback, ms, next: fakeNow + ms });
    return id as unknown as NodeJS.Timeout;
  };

  (globalThis as any).clearInterval = (id: NodeJS.Timeout) => {
    intervals.delete(id as unknown as number);
  };

  const {
    startRealtimeTranscription,
    stopRealtimeTranscription,
    _resetRealtimeState,
  } = await import("@/shared/ai/stt/realtime");

  _resetRealtimeState();

  const mockAudioModule = {
    requestRecordingPermissionsAsync: () => Promise.resolve({ granted: true }),
  };
  const mockRecorder = {
    startAsync: () => Promise.resolve(),
    stopAsync: () => Promise.resolve(),
    uri: "mock://audio/test.wav",
  };

  // Temporarily override expo-audio mock for this simulation
  mock.module("expo-audio", () => ({
    AudioModule: mockAudioModule,
    AudioRecorder: () => mockRecorder,
  }));

  const options = {
    language: "pt",
    onPartialResult: () => {
      partialCallCount++;
    },
    onFinalResult: () => {},
  };

  await startRealtimeTranscription(options);

  // Advance fake clock in 500 ms steps, firing intervals as they come due
  const steps = Math.ceil(durationMs / 500);
  for (let i = 0; i < steps; i++) {
    fakeNow += 500;
    // Fire any intervals that are due
    for (const [id, interval] of intervals) {
      if (fakeNow >= interval.next) {
        interval.next = fakeNow + interval.ms;
        // The interval callback is async; we await it to let partial results accumulate
        await Promise.resolve(interval.callback());
      }
    }
  }

  await stopRealtimeTranscription();

  // Restore originals
  Date.now = originalDateNow;
  (globalThis as any).setInterval = originalSetInterval;
  (globalThis as any).clearInterval = originalClearInterval;

  return partialCallCount;
}

// ---------------------------------------------------------------------------
// Property 8 — Realtime throttle
// Validates: Requirements 9.3
// Feature: ai-model-manager-stt, Property 8: realtime throttle
// ---------------------------------------------------------------------------
describe("Property 8: Realtime throttle", () => {
  beforeEach(async () => {
    const { _resetRealtimeState } = await import("@/shared/ai/stt/realtime");
    _resetRealtimeState();
  });

  afterEach(async () => {
    const { _resetRealtimeState } = await import("@/shared/ai/stt/realtime");
    _resetRealtimeState();
  });

  it("**Validates: Requirements 9.3** - onPartialResult call count ≤ ⌈duration / 0.5⌉", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate session durations from 1 s to 60 s (in milliseconds)
        fc.integer({ min: 1000, max: 60000 }),
        async (durationMs) => {
          const durationSeconds = durationMs / 1000;
          // Maximum allowed calls: ⌈duration_in_seconds / 0.5⌉
          const maxAllowedCalls = Math.ceil(durationSeconds / 0.5);

          const actualCalls = await simulateSession(durationMs);

          expect(actualCalls).toBeLessThanOrEqual(maxAllowedCalls);
        },
      ),
      { numRuns: 100 },
    );
  });
});
