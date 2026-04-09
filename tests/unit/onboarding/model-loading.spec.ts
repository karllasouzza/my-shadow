/**
 * T025: Unit test for llama.rn model loading
 *
 * Tests the LocalAIRuntimeService.loadModel() behavior with mocked llama.rn
 * module and mock .gguf file paths.
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: jest.fn((obj) => obj.ios ?? obj.default) },
  NativeModules: {},
  AppState: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
}));

import { LocalAIRuntimeService } from "../../../shared/ai/local-ai-runtime";

describe("T025: Model Loading (llama.rn)", () => {
  let service: LocalAIRuntimeService;

  beforeEach(() => {
    service = new LocalAIRuntimeService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initialize()", () => {
    it("should initialize successfully on native platform", async () => {
      const result = await service.initialize();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it("should return early if already initialized (idempotent)", async () => {
      const first = await service.initialize();
      const second = await service.initialize();

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
    });
  });

  describe("loadModel()", () => {
    it("should load a model with a valid .gguf file path", async () => {
      const modelPath = "file:///data/models/qwen2.5-0.5b-q4.gguf";
      const modelId = "qwen2.5-0.5b-q4";

      const result = await service.loadModel(modelId, modelPath);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(modelId);
        expect(result.data.path).toBe(modelPath);
        expect(result.data.isLoaded).toBe(true);
        expect(result.data.contextLength).toBe(4096);
      }
    });

    it("should automatically initialize if not already initialized", async () => {
      const result = await service.loadModel(
        "test-model",
        "file:///test/model.gguf",
      );

      expect(result.success).toBe(true);
      expect(service.isModelLoaded()).toBe(true);
    });

    it("should return the existing model if already loaded (idempotent)", async () => {
      const first = await service.loadModel(
        "model-a",
        "file:///test/model-a.gguf",
      );
      const second = await service.loadModel(
        "model-a",
        "file:///test/model-a.gguf",
      );

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      if (first.success && second.success) {
        expect(first.data.id).toBe(second.data.id);
      }
    });

    it("should unload existing model before loading a new one", async () => {
      await service.loadModel("model-a", "file:///test/model-a.gguf");
      const result = await service.loadModel(
        "model-b",
        "file:///test/model-b.gguf",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("model-b");
      }

      const currentModel = service.getCurrentModel();
      expect(currentModel?.id).toBe("model-b");
    });

    it("should add file:// prefix if missing from model path", async () => {
      const result = await service.loadModel(
        "my-model",
        "/data/models/model.gguf",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe("file:///data/models/model.gguf");
      }
    });

    it("should use fallback path when modelPath is empty", async () => {
      const result = await service.loadModel("qwen2.5-0.5b-q4", "");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe("file://qwen2.5-0.5b-q4.gguf");
      }
    });

    it("should fail when llama.rn initLlama throws", async () => {
      const llamaModule = require("llama.rn");
      const spy = jest
        .spyOn(llamaModule, "initLlama")
        .mockRejectedValue(new Error("Native module unavailable"));

      const freshService = new LocalAIRuntimeService();
      const result = await freshService.loadModel(
        "broken-model",
        "file:///test/broken.gguf",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_READY");
        expect(result.error.message).toContain("Failed to load model");
      }

      spy.mockRestore();
    });
  });

  describe("isModelLoaded()", () => {
    it("should return false before any model is loaded", () => {
      expect(service.isModelLoaded()).toBe(false);
    });

    it("should return true after a model is successfully loaded", async () => {
      await service.loadModel("test-model", "file:///test/model.gguf");
      expect(service.isModelLoaded()).toBe(true);
    });

    it("should return true when checking the correct model ID", async () => {
      await service.loadModel("specific-model", "file:///test/model.gguf");
      expect(service.isModelLoaded("specific-model")).toBe(true);
    });

    it("should return false when checking a different model ID", async () => {
      await service.loadModel("model-a", "file:///test/model-a.gguf");
      expect(service.isModelLoaded("model-b")).toBe(false);
    });

    it("should return false if runtime is not initialized", () => {
      const freshService = new LocalAIRuntimeService();
      expect(freshService.isModelLoaded()).toBe(false);
    });
  });

  describe("getCurrentModel()", () => {
    it("should return null before any model is loaded", () => {
      expect(service.getCurrentModel()).toBeNull();
    });

    it("should return the loaded model after loadModel()", async () => {
      await service.loadModel("test", "file:///test/model.gguf");
      const model = service.getCurrentModel();

      expect(model).not.toBeNull();
      expect(model?.id).toBe("test");
      expect(model?.isLoaded).toBe(true);
    });
  });

  describe("unloadModel()", () => {
    it("should succeed even if no model is loaded", async () => {
      const result = await service.unloadModel();
      expect(result.success).toBe(true);
    });

    it("should unload the current model", async () => {
      await service.loadModel("test", "file:///test/model.gguf");
      expect(service.isModelLoaded()).toBe(true);

      const result = await service.unloadModel();

      expect(result.success).toBe(true);
      expect(service.isModelLoaded()).toBe(false);
      expect(service.getCurrentModel()).toBeNull();
    });
  });
});
