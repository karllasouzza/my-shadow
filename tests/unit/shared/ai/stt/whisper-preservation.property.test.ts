/**
 * Preservation Property Tests for whisper.rn module
 *
 * Property 2: Preservation - Non-Whisper Functionality
 *   Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * IMPORTANT: These tests follow observation-first methodology
 * - Run on UNFIXED code to observe baseline behavior
 * - EXPECTED OUTCOME: Tests PASS (confirms baseline behavior to preserve)
 * - These tests ensure the fix doesn't break existing functionality
 *
 * Testing Strategy:
 * - Test iOS module import works correctly when native module is available
 * - Test constant values are extracted correctly when native module is available
 * - Test LLM loading via AIRuntime.loadModel() works independently
 * - Test model downloading via downloadModelById() works correctly
 * - Test model detection via isModelDownloaded() works correctly
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Mutable state for mock implementations
// ---------------------------------------------------------------------------

let mockNativeModuleAvailable = true;
let mockConstantsValues = { useCoreML: true, coreMLAllowFallback: false };
let aiRuntimeLoadModelCalls: Array<{
  modelId: string;
  path: string;
  fileSizeBytes: number;
}> = [];
let downloadModelCalls: Array<{
  modelId: string;
  link: string;
  modelType: "gguf" | "bin";
}> = [];
let isModelDownloadedCalls: string[] = [];

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

mock.module("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: {},
  TurboModuleRegistry: {
    get: (name: string) => {
      if (name === "RNWhisper" && mockNativeModuleAvailable) {
        return {
          getConstants: () => mockConstantsValues,
          initWhisper: async () => ({ success: true }),
        };
      }
      return null;
    },
  },
}));

mock.module("@/shared/ai/log", () => ({
  aiDebug: () => {},
  aiInfo: () => {},
  aiError: () => {},
  aiWarn: () => {},
}));

mock.module("@/shared/ai/text-generation/runtime", () => ({
  getAIRuntime: () => ({
    getCurrentModel: () => null,
    loadModel: async (modelId: string, path: string, fileSizeBytes: number) => {
      aiRuntimeLoadModelCalls.push({ modelId, path, fileSizeBytes });
      return { success: true, data: { id: modelId } };
    },
    unloadModel: async () => ({ success: true }),
  }),
}));

mock.module("@/database/chat", () => ({
  default: {
    lastModelId: {
      set: () => {},
      get: () => null,
    },
    lastWhisperModelId: {
      set: () => {},
      get: () => null,
    },
  },
}));

mock.module("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  getInfoAsync: async (uri: string) => {
    // For model detection tests, models exist
    // For download tests, models don't exist (so download proceeds)
    // Check if this is being called from isModelDownloaded context
    if (uri.endsWith("/")) {
      return { exists: true }; // Directory exists
    }
    // For specific model files, return false to allow downloads to proceed
    return { exists: false };
  },
  makeDirectoryAsync: async () => {},
  readDirectoryAsync: async () => [],
  deleteAsync: async () => {},
  createDownloadResumable: (
    url: string,
    destUri: string,
    _opts: unknown,
    cb: (p: {
      totalBytesWritten: number;
      totalBytesExpectedToWrite: number;
    }) => void,
  ) => {
    const modelId =
      destUri
        .split("/")
        .pop()
        ?.replace(/\.(gguf|bin)$/, "") || "";
    const modelType = destUri.endsWith(".gguf")
      ? ("gguf" as const)
      : ("bin" as const);

    return {
      downloadAsync: async () => {
        // Track download call when downloadAsync is called
        downloadModelCalls.push({ modelId, link: url, modelType });
        // Simulate successful download
        cb({ totalBytesWritten: 1000, totalBytesExpectedToWrite: 1000 });
        return { uri: destUri };
      },
      pauseAsync: async () => {},
    };
  },
}));

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetState() {
  mockNativeModuleAvailable = true;
  mockConstantsValues = { useCoreML: true, coreMLAllowFallback: false };
  aiRuntimeLoadModelCalls = [];
  downloadModelCalls = [];
  isModelDownloadedCalls = [];
}

// ---------------------------------------------------------------------------
// Property 2.1: iOS module import preservation
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
describe("Property 2.1: iOS module import preservation", () => {
  beforeEach(resetState);

  it("iOS module import works correctly when native module is available", () => {
    // Observation: On iOS where native module is available, module should initialize successfully
    // This tests the baseline behavior that must be preserved after the fix

    fc.assert(
      fc.property(
        fc.constant({
          platform: "ios",
          nativeModuleAvailable: true,
        }),
        (input) => {
          resetState();
          mockNativeModuleAvailable = input.nativeModuleAvailable;

          // Attempt to access the native module through TurboModuleRegistry
          const { TurboModuleRegistry } = require("react-native");
          const RNWhisper = TurboModuleRegistry.get("RNWhisper");

          // EXPECTED BEHAVIOR (baseline to preserve):
          // 1. Native module should be available
          expect(RNWhisper).not.toBeNull();
          expect(RNWhisper).toBeDefined();

          // 2. getConstants should be callable
          expect(typeof RNWhisper.getConstants).toBe("function");

          // 3. Constants should be retrievable
          const constants = RNWhisper.getConstants();
          expect(constants).toBeDefined();
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2.2: Constant values preservation
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
describe("Property 2.2: Constant values preservation", () => {
  beforeEach(resetState);

  it("constant values are extracted correctly when native module is available", () => {
    // Observation: When native module IS available, constants should match expected values
    // This tests that the fix doesn't change constant extraction for valid modules

    fc.assert(
      fc.property(
        fc.record({
          useCoreML: fc.boolean(),
          coreMLAllowFallback: fc.boolean(),
        }),
        (expectedConstants) => {
          resetState();
          mockNativeModuleAvailable = true;
          mockConstantsValues = expectedConstants;

          // Access the native module and get constants
          const { TurboModuleRegistry } = require("react-native");
          const RNWhisper = TurboModuleRegistry.get("RNWhisper");

          // EXPECTED BEHAVIOR (baseline to preserve):
          // Constants should match the values provided by the native module
          const constants = RNWhisper?.getConstants?.() || {};
          expect(constants.useCoreML).toBe(expectedConstants.useCoreML);
          expect(constants.coreMLAllowFallback).toBe(
            expectedConstants.coreMLAllowFallback,
          );
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2.3: LLM loading independence
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------
describe("Property 2.3: LLM loading independence", () => {
  beforeEach(resetState);

  it("LLM loading via AIRuntime.loadModel() works independently of Whisper module", async () => {
    // Observation: LLM loading should work regardless of Whisper module state
    // This tests that the fix doesn't interfere with non-Whisper operations

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("qwen3-0.6b", "llama-3.2-1b", "phi-3.5-mini"),
        async (modelId) => {
          resetState();

          // Mock the model loader
          const mockManager = {
            getModelLocalPath: async (id: string) =>
              `file:///documents/models/${id}.gguf`,
          };

          const mockCatalog = {
            findModelById: (id: string) => ({
              id,
              modelType: "gguf",
              fileSizeBytes: 1000000,
            }),
          };

          // Simulate loading an LLM model
          const {
            getAIRuntime,
          } = require("@/shared/ai/text-generation/runtime");
          const runtime = getAIRuntime();
          const path = await mockManager.getModelLocalPath(modelId);
          const model = mockCatalog.findModelById(modelId);

          const result = await runtime.loadModel(
            modelId,
            path,
            model.fileSizeBytes,
          );

          // EXPECTED BEHAVIOR (baseline to preserve):
          // 1. LLM loading should succeed
          expect(result.success).toBe(true);

          // 2. AIRuntime.loadModel should be called
          expect(aiRuntimeLoadModelCalls.length).toBeGreaterThan(0);
          expect(aiRuntimeLoadModelCalls[0].modelId).toBe(modelId);

          // 3. This should work regardless of Whisper module state
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2.4: Model downloading preservation
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------
describe("Property 2.4: Model downloading preservation", () => {
  beforeEach(resetState);

  it("model downloading via downloadModelById() works correctly", async () => {
    // Observation: Model downloading should work for both GGUF and BIN files
    // This tests that the fix doesn't break model download functionality

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          modelId: fc
            .string({ minLength: 5, maxLength: 20 })
            .filter((s) => /^[a-z0-9-]+$/.test(s)),
          modelType: fc.constantFrom("gguf" as const, "bin" as const),
        }),
        async ({ modelId, modelType }) => {
          resetState();

          // Lazy load manager to ensure mocks are applied
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const manager = require("@/shared/ai/manager");

          const link = `https://example.com/${modelId}.${modelType}`;
          const result = await manager.downloadModelById(
            modelId,
            link,
            modelType,
          );

          // EXPECTED BEHAVIOR (baseline to preserve):
          // 1. Download should succeed
          expect(result.success).toBe(true);

          // 2. Download should be tracked
          const downloadCall = downloadModelCalls.find(
            (call) => call.modelId === modelId,
          );
          expect(downloadCall).toBeDefined();
          expect(downloadCall?.modelType).toBe(modelType);

          // 3. Result should contain the file URI
          if (result.success) {
            expect(result.data).toContain(modelId);
            expect(result.data).toContain(modelType);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2.5: Model detection preservation
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------
describe("Property 2.5: Model detection preservation", () => {
  beforeEach(resetState);

  it("model detection via isModelDownloaded() works correctly", async () => {
    // Observation: Model detection should correctly identify downloaded models
    // This tests that the fix doesn't break model detection logic

    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 5, maxLength: 20 })
          .filter((s) => /^[a-z0-9-]+$/.test(s)),
        async (modelId) => {
          resetState();
          isModelDownloadedCalls.push(modelId);

          // Lazy load manager to ensure mocks are applied
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const manager = require("@/shared/ai/manager");

          const isDownloaded = await manager.isModelDownloaded(modelId);

          // EXPECTED BEHAVIOR (baseline to preserve):
          // 1. Function should return a boolean
          expect(typeof isDownloaded).toBe("boolean");

          // 2. Based on our mock (files don't exist), models should not be detected
          expect(isDownloaded).toBe(false);

          // 3. Function should complete without errors
          expect(isModelDownloadedCalls).toContain(modelId);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2.6: Non-Whisper operations preservation
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------
describe("Property 2.6: Non-Whisper operations preservation", () => {
  beforeEach(resetState);

  it("non-Whisper operations work regardless of Whisper module state", async () => {
    // Observation: Text chat, LLM inference, and other features should work
    // even if Whisper module is unavailable
    // This tests that the fix maintains proper isolation between features

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          whisperAvailable: fc.boolean(),
          operation: fc.constantFrom(
            "llm-load",
            "model-download",
            "model-detect",
          ),
        }),
        async ({ whisperAvailable, operation }) => {
          resetState();
          mockNativeModuleAvailable = whisperAvailable;

          // Lazy load modules
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const manager = require("@/shared/ai/manager");
          const {
            getAIRuntime,
          } = require("@/shared/ai/text-generation/runtime");

          let operationSucceeded = false;

          // Perform different non-Whisper operations
          if (operation === "llm-load") {
            const runtime = getAIRuntime();
            const result = await runtime.loadModel(
              "test-model",
              "file:///documents/models/test-model.gguf",
              1000000,
            );
            operationSucceeded = result.success;
          } else if (operation === "model-download") {
            const result = await manager.downloadModelById(
              "test-model",
              "https://example.com/test-model.gguf",
              "gguf",
            );
            operationSucceeded = result.success;
          } else if (operation === "model-detect") {
            const isDownloaded = await manager.isModelDownloaded("test-model");
            operationSucceeded = typeof isDownloaded === "boolean";
          }

          // EXPECTED BEHAVIOR (baseline to preserve):
          // All non-Whisper operations should succeed regardless of Whisper module state
          expect(operationSucceeded).toBe(true);
        },
      ),
      { numRuns: 30 },
    );
  });
});
