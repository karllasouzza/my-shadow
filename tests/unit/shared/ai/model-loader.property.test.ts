/**
 * Property-based tests for shared/ai/model-loader.ts
 *
 * Property 4 — Model type routing (task 8.5)
 *   Validates: Requirements 4.1, 4.2
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Mutable state for mock implementations
// ---------------------------------------------------------------------------

let aiRuntimeLoadModelCalls: Array<{
  modelId: string;
  path: string;
  fileSizeBytes: number;
}> = [];
let whisperRuntimeLoadModelCalls: Array<{ modelId: string; path: string }> = [];

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

mock.module("react-native", () => ({
  Platform: { OS: "test" },
  NativeModules: {},
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

mock.module("@/shared/ai/log", () => ({
  aiDebug: () => {},
  aiInfo: () => {},
  aiError: () => {},
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

mock.module("@/shared/ai/stt/runtime", () => ({
  getWhisperRuntime: () => ({
    getCurrentModel: () => null,
    loadModel: async (modelId: string, path: string) => {
      whisperRuntimeLoadModelCalls.push({ modelId, path });
      return { success: true, data: { id: modelId } };
    },
    unloadModel: async () => ({ success: true }),
  }),
}));

mock.module("@/shared/ai/manager", () => ({
  getModelLocalPath: async (modelId: string) => {
    // Mock that all models are downloaded
    const isWhisper = modelId.startsWith("whisper-");
    const ext = isWhisper ? ".bin" : ".gguf";
    return `file:///documents/models/${modelId}${ext}`;
  },
  getDownloadedModels: async () => ({}),
  removeDownloadedModel: async () => ({ success: true }),
}));

// ---------------------------------------------------------------------------
// Lazy module import via require (ensures mocks are applied before module loads)
// ---------------------------------------------------------------------------

interface ModelLoaderAPI {
  loadModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
}

let _modelLoaderCache: any = null;

function getModelLoader(): ModelLoaderAPI {
  if (!_modelLoaderCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _modelLoaderCache = require("@/shared/ai/model-loader");
  }
  return _modelLoaderCache as ModelLoaderAPI;
}

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetState() {
  aiRuntimeLoadModelCalls = [];
  whisperRuntimeLoadModelCalls = [];
}

// ---------------------------------------------------------------------------
// Property 4 — Model type routing
// Validates: Requirements 4.1, 4.2
// Tag: Feature: ai-model-manager-stt, Property 4: model type routing
// ---------------------------------------------------------------------------
describe("Property 4: model type routing", () => {
  beforeEach(resetState);

  it("loadModel calls getAIRuntime().loadModel iff modelType === 'gguf' and getWhisperRuntime().loadModel iff modelType === 'bin'", async () => {
    const { loadModel } = getModelLoader();

    // Import catalogs to get real model IDs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllModels } = require("@/shared/ai/text-generation/catalog");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllWhisperModels } = require("@/shared/ai/stt/catalog");

    const llmModels = getAllModels();
    const whisperModels = getAllWhisperModels();
    const allModels = [...llmModels, ...whisperModels];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...allModels.map((m: any) => m.id)),
        async (modelId) => {
          resetState();

          // Find the model in the catalog to determine its type
          const model = allModels.find((m: any) => m.id === modelId);
          expect(model).toBeDefined();

          const result = await loadModel(modelId);

          // Assert the load was successful
          expect(result.success).toBe(true);

          // Assert the correct runtime was called based on modelType
          if (model.modelType === "gguf") {
            // Should call AIRuntime.loadModel
            expect(aiRuntimeLoadModelCalls.length).toBe(1);
            expect(aiRuntimeLoadModelCalls[0].modelId).toBe(modelId);
            expect(aiRuntimeLoadModelCalls[0].path).toContain(modelId);
            expect(aiRuntimeLoadModelCalls[0].path).toContain(".gguf");

            // Should NOT call WhisperRuntime.loadModel
            expect(whisperRuntimeLoadModelCalls.length).toBe(0);
          } else if (model.modelType === "bin") {
            // Should call WhisperRuntime.loadModel
            expect(whisperRuntimeLoadModelCalls.length).toBe(1);
            expect(whisperRuntimeLoadModelCalls[0].modelId).toBe(modelId);
            expect(whisperRuntimeLoadModelCalls[0].path).toContain(modelId);
            expect(whisperRuntimeLoadModelCalls[0].path).toContain(".bin");

            // Should NOT call AIRuntime.loadModel
            expect(aiRuntimeLoadModelCalls.length).toBe(0);
          } else {
            throw new Error(`Unexpected modelType: ${model.modelType}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
