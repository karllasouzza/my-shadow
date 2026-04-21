/**
 * Unit tests for shared/ai/model-loader.ts guard conditions
 *
 * Task 8.6 — Write unit tests for model-loader guards
 *   Validates: Requirements 4.3, 4.4
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";

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
      return { success: true, data: { id: modelId } };
    },
    unloadModel: async () => ({ success: true }),
  }),
}));

mock.module("@/shared/ai/stt/runtime", () => ({
  getWhisperRuntime: () => ({
    getCurrentModel: () => null,
    loadModel: async (modelId: string, path: string) => {
      return { success: true, data: { id: modelId } };
    },
    unloadModel: async () => ({ success: true }),
  }),
}));

// Mutable state for manager mock
let mockDownloadedModels: Record<string, any> = {};
let mockModelLocalPath: Record<string, string | null> = {};

mock.module("@/shared/ai/manager", () => ({
  getModelLocalPath: async (modelId: string) => {
    return mockModelLocalPath[modelId] ?? null;
  },
  getDownloadedModels: async () => mockDownloadedModels,
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
  mockDownloadedModels = {};
  mockModelLocalPath = {};
}

// ---------------------------------------------------------------------------
// Unit tests for guard conditions
// Validates: Requirements 4.3, 4.4
// ---------------------------------------------------------------------------

describe("model-loader guard conditions", () => {
  beforeEach(resetState);

  describe("NOT_FOUND guard (Requirement 4.3)", () => {
    it("returns { success: false, error: 'Modelo não encontrado' } when modelId is not in catalog", async () => {
      const { loadModel } = getModelLoader();

      // Use a modelId that doesn't exist in either catalog
      const result = await loadModel("nonexistent-model-id-12345");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Modelo não encontrado");
    });

    it("returns NOT_FOUND for empty string modelId", async () => {
      const { loadModel } = getModelLoader();

      const result = await loadModel("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Modelo não encontrado");
    });

    it("returns NOT_FOUND for random invalid modelId", async () => {
      const { loadModel } = getModelLoader();

      const result = await loadModel("invalid-model-xyz");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Modelo não encontrado");
    });
  });

  describe("NOT_DOWNLOADED guard (Requirement 4.4)", () => {
    it("returns { success: false, error: 'Modelo não baixado' } when LLM model is in catalog but not downloaded", async () => {
      const { loadModel } = getModelLoader();

      // Import catalog to get a real LLM model ID
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getAllModels } = require("@/shared/ai/text-generation/catalog");
      const llmModels = getAllModels();
      const llmModelId = llmModels[0].id;

      // Mock that the model is NOT downloaded (getModelLocalPath returns null)
      mockModelLocalPath[llmModelId] = null;

      const result = await loadModel(llmModelId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Modelo não baixado");
    });

    it("returns { success: false, error: 'Modelo não baixado' } when Whisper model is in catalog but not downloaded", async () => {
      const { loadModel } = getModelLoader();

      // Import catalog to get a real Whisper model ID
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getAllWhisperModels } = require("@/shared/ai/stt/catalog");
      const whisperModels = getAllWhisperModels();
      const whisperModelId = whisperModels[0].id;

      // Mock that the model is NOT downloaded (getModelLocalPath returns null)
      mockModelLocalPath[whisperModelId] = null;

      const result = await loadModel(whisperModelId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Modelo não baixado");
    });

    it("succeeds when model is in catalog AND downloaded", async () => {
      const { loadModel } = getModelLoader();

      // Import catalog to get a real LLM model ID
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getAllModels } = require("@/shared/ai/text-generation/catalog");
      const llmModels = getAllModels();
      const llmModelId = llmModels[0].id;

      // Mock that the model IS downloaded
      mockModelLocalPath[llmModelId] =
        `file:///documents/models/${llmModelId}.gguf`;

      const result = await loadModel(llmModelId);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("guard order verification", () => {
    it("checks catalog existence before checking download status", async () => {
      const { loadModel } = getModelLoader();

      // Use a non-existent model ID
      const nonExistentId = "does-not-exist-anywhere";

      // Even if we mock it as "downloaded", it should fail with NOT_FOUND first
      mockModelLocalPath[nonExistentId] =
        `file:///documents/models/${nonExistentId}.gguf`;

      const result = await loadModel(nonExistentId);

      // Should fail with NOT_FOUND, not NOT_DOWNLOADED
      expect(result.success).toBe(false);
      expect(result.error).toBe("Modelo não encontrado");
    });
  });
});
