/**
 * Property-based tests for shared/ai/manager.ts
 *
 * Property 1 — Concurrent downloads are independent (task 5.10)
 *   Validates: Requirements 2.1
 * Property 2 — Duplicate download deduplication (task 5.7)
 *   Validates: Requirements 2.2
 * Property 3 — Download progress monotonicity (task 5.8)
 *   Validates: Requirements 2.3
 * Property 7 — Cache invalidation consistency (task 5.9)
 *   Validates: Requirements 1.6, 1.7
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Mutable state for mock implementations
// ---------------------------------------------------------------------------

let createDownloadResumableCallCount = 0;
let downloadResumableInstances: MockDownloadResumable[] = [];

interface MockDownloadResumable {
  downloadAsync: () => Promise<{ uri: string } | null>;
  pauseAsync: () => Promise<void>;
  _resolve: (uri: string) => void;
  _reject: (err: Error) => void;
  _progressCb: (p: {
    totalBytesWritten: number;
    totalBytesExpectedToWrite: number;
  }) => void;
}

function makeMockResumable(
  _destUri: string,
  cb: (p: {
    totalBytesWritten: number;
    totalBytesExpectedToWrite: number;
  }) => void,
): MockDownloadResumable {
  let _resolve!: (uri: string) => void;
  let _reject!: (err: Error) => void;
  const promise = new Promise<{ uri: string } | null>((res, rej) => {
    _resolve = (uri) => res({ uri });
    _reject = rej;
  });
  return {
    downloadAsync: () => promise,
    pauseAsync: async () => {},
    _resolve,
    _reject,
    _progressCb: cb,
  };
}

let fsGetInfoImpl: (uri: string) => Promise<{ exists: boolean }> = async (
  uri,
) => ({ exists: uri.endsWith("/") });
let fsReadDirImpl: () => Promise<string[]> = async () => [];

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

mock.module("react-native", () => ({
  Platform: { OS: "test" },
  NativeModules: {},
}));

mock.module("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  getInfoAsync: (uri: string) => fsGetInfoImpl(uri),
  makeDirectoryAsync: async () => {},
  readDirectoryAsync: () => fsReadDirImpl(),
  deleteAsync: async () => {},
  createDownloadResumable: (
    _url: string,
    destUri: string,
    _opts: unknown,
    cb: (p: {
      totalBytesWritten: number;
      totalBytesExpectedToWrite: number;
    }) => void,
  ) => {
    createDownloadResumableCallCount++;
    const instance = makeMockResumable(destUri, cb);
    downloadResumableInstances.push(instance);
    return instance;
  },
}));

mock.module("expo-file-system", () => ({
  documentDirectory: "file:///documents/",
}));

mock.module("@/shared/ai/text-generation/runtime", () => ({
  getAIRuntime: () => ({
    getCurrentModel: () => null,
    unloadModel: async () => ({ success: true }),
  }),
}));

mock.module("llama.rn", () => ({ initLlama: async () => ({}) }));

mock.module("@/shared/ai/log", () => ({
  aiDebug: () => {},
  aiInfo: () => {},
  aiError: () => {},
}));

// ---------------------------------------------------------------------------
// Lazy module import via require (ensures mocks are applied before module loads)
// ---------------------------------------------------------------------------

interface ManagerAPI {
  downloadModelById: (
    modelId: string,
    link: string,
    modelType: "gguf" | "bin",
    onProgress?: (info: { modelId: string; progress: number }) => void,
  ) => Promise<{ success: boolean; data?: string; error?: unknown }>;
  getDownloadedModels: () => Promise<
    Record<
      string,
      { modelId: string; localPath: string; modelType: "gguf" | "bin" }
    >
  >;
  getDownloadProgress: (modelId: string) => number | null;
  invalidateDownloadedModelsCache: () => void;
  _clearActiveDownloadsForTesting: () => void;
}

let _managerCache: any = null;

function getManager(): ManagerAPI {
  if (!_managerCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _managerCache = require("@/shared/ai/manager");
  }
  return _managerCache as ManagerAPI;
}

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetState() {
  createDownloadResumableCallCount = 0;
  downloadResumableInstances = [];
  fsGetInfoImpl = async (uri: string) => ({ exists: uri.endsWith("/") });
  fsReadDirImpl = async () => [];
  const m = getManager();
  m.invalidateDownloadedModelsCache();
  m._clearActiveDownloadsForTesting();
}

// Helper to wait for microtasks to flush
function flushPromises(times = 3): Promise<void> {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) {
    p = p.then(() => Promise.resolve());
  }
  return p;
}

// ---------------------------------------------------------------------------
// Property 2 — Duplicate download deduplication
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------
describe("Property 2: Duplicate download deduplication", () => {
  beforeEach(resetState);
  afterEach(resetState);

  it("N concurrent calls for the same modelId produce exactly one createDownloadResumable call and all resolve to the same value", async () => {
    const { downloadModelById } = getManager();

    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-z0-9-]+$/.test(s)),
        fc.integer({ min: 2, max: 8 }),
        async (modelId, n) => {
          resetState();

          const promises = Array.from({ length: n }, () =>
            downloadModelById(
              modelId,
              `https://example.com/${modelId}.gguf`,
              "gguf",
            ),
          );

          // Wait for the download to be initiated and resumable created
          await flushPromises();

          // Resolve the download
          const resumable = downloadResumableInstances[0];
          if (resumable) {
            resumable._resolve(`file:///documents/models/${modelId}.gguf`);
          }

          const results = await Promise.all(promises);

          // Exactly one network call
          expect(createDownloadResumableCallCount).toBe(1);

          // All N results are identical
          const first = JSON.stringify(results[0]);
          for (const r of results) {
            expect(JSON.stringify(r)).toBe(first);
          }

          // All succeeded
          for (const r of results) {
            expect(r.success).toBe(true);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — Download progress monotonicity
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------
describe("Property 3: Download progress monotonicity", () => {
  beforeEach(resetState);
  afterEach(resetState);

  it("reported progress values are non-decreasing and end at 100 on success", async () => {
    const { downloadModelById } = getManager();

    await fc.assert(
      fc.asyncProperty(
        fc
          .array(fc.integer({ min: 0, max: 1000 }), {
            minLength: 1,
            maxLength: 15,
          })
          .map((arr) => [...arr].sort((a, b) => a - b)),
        async (bytesSequence) => {
          resetState();

          const totalBytes = Math.max(
            bytesSequence[bytesSequence.length - 1] ?? 1,
            1,
          );
          const progressValues: number[] = [];
          const modelId = "progress-test-model";

          const downloadPromise = downloadModelById(
            modelId,
            "https://example.com/model.gguf",
            "gguf",
            (info) => progressValues.push(info.progress),
          );

          // Wait for the download to be initiated and resumable created
          await flushPromises();

          const resumable = downloadResumableInstances[0];
          if (resumable) {
            for (const written of bytesSequence) {
              resumable._progressCb({
                totalBytesWritten: written,
                totalBytesExpectedToWrite: totalBytes,
              });
            }
            resumable._resolve(`file:///documents/models/${modelId}.gguf`);
          }

          await downloadPromise;

          // Non-decreasing
          for (let i = 1; i < progressValues.length; i++) {
            expect(progressValues[i]).toBeGreaterThanOrEqual(
              progressValues[i - 1],
            );
          }

          // Ends at 100
          expect(progressValues[progressValues.length - 1]).toBe(100);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7 — Cache invalidation consistency
// Validates: Requirements 1.6, 1.7
// ---------------------------------------------------------------------------
describe("Property 7: Cache invalidation consistency", () => {
  beforeEach(resetState);
  afterEach(resetState);

  it("getDownloadedModels always reflects true disk state after invalidation", async () => {
    const { getDownloadedModels, invalidateDownloadedModelsCache } =
      getManager();

    await fc.assert(
      fc.asyncProperty(
        fc
          .array(
            fc
              .string({ minLength: 1, maxLength: 15 })
              .filter((s) => /^[a-z0-9-]+$/.test(s)),
            { minLength: 0, maxLength: 5 },
          )
          .map((arr) => [...new Set(arr)]),
        fc.array(fc.boolean(), { minLength: 0, maxLength: 5 }),
        async (modelIds, isGgufFlags) => {
          const diskFiles = modelIds.map((id, i) => {
            const ext = (isGgufFlags[i] ?? true) ? ".gguf" : ".bin";
            return `${id}${ext}`;
          });

          fsReadDirImpl = async () => diskFiles;
          invalidateDownloadedModelsCache();

          const result = await getDownloadedModels();

          // Every file on disk must appear in result
          for (const file of diskFiles) {
            const isGguf = file.endsWith(".gguf");
            const id = file.replace(/\.(gguf|bin)$/, "");
            expect(result[id]).toBeDefined();
            expect(result[id].modelId).toBe(id);
            expect(result[id].modelType).toBe(isGguf ? "gguf" : "bin");
            expect(result[id].localPath).toContain(file);
          }

          // No extra models
          expect(Object.keys(result).length).toBe(diskFiles.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 1 — Concurrent downloads are independent
// Validates: Requirements 2.1
// ---------------------------------------------------------------------------
describe("Property 1: Concurrent downloads are independent", () => {
  beforeEach(resetState);
  afterEach(resetState);

  it("completion of one download does not affect progress or outcome of another", async () => {
    const { downloadModelById, getDownloadProgress } = getManager();

    await fc.assert(
      fc.asyncProperty(
        fc
          .tuple(
            fc
              .string({ minLength: 1, maxLength: 15 })
              .filter((s) => /^[a-z0-9-]+$/.test(s)),
            fc
              .string({ minLength: 1, maxLength: 15 })
              .filter((s) => /^[a-z0-9-]+$/.test(s)),
          )
          .filter(([a, b]) => a !== b),
        async ([modelIdA, modelIdB]) => {
          resetState();

          const progressA: number[] = [];
          const progressB: number[] = [];

          const promiseA = downloadModelById(
            modelIdA,
            `https://example.com/${modelIdA}.gguf`,
            "gguf",
            (info) => progressA.push(info.progress),
          );
          const promiseB = downloadModelById(
            modelIdB,
            `https://example.com/${modelIdB}.bin`,
            "bin",
            (info) => progressB.push(info.progress),
          );

          // Wait for the downloads to be initiated and resumables created
          await flushPromises();

          // Two separate resumable instances
          expect(downloadResumableInstances.length).toBe(2);

          const resumableA = downloadResumableInstances[0];
          const resumableB = downloadResumableInstances[1];

          // Resolve A first
          resumableA._resolve(`file:///documents/models/${modelIdA}.gguf`);
          const resultA = await promiseA;

          // B should still be in-progress
          const progressBAfterA = getDownloadProgress(modelIdB);
          expect(progressBAfterA).not.toBeNull();

          // Resolve B
          resumableB._resolve(`file:///documents/models/${modelIdB}.bin`);
          const resultB = await promiseB;

          // Both succeed independently
          expect(resultA.success).toBe(true);
          expect(resultB.success).toBe(true);

          if (resultA.success) {
            expect(resultA.data).toContain(modelIdA);
          }
          if (resultB.success) {
            expect(resultB.data).toContain(modelIdB);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
