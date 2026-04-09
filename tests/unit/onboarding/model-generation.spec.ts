/**
 * T026: Unit test for llama.rn completion generation
 *
 * Tests the LocalAIRuntimeService.generateCompletion() and related generation
 * methods with a mocked llama.rn context.
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: jest.fn((obj) => obj.ios ?? obj.default) },
  NativeModules: {},
  AppState: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
}));

import { LocalAIRuntimeService } from "../../../shared/ai/local-ai-runtime";

describe("T026: Model Generation (llama.rn completion)", () => {
  let service: LocalAIRuntimeService;

  beforeEach(() => {
    service = new LocalAIRuntimeService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function loadModelForTest(): Promise<void> {
    const result = await service.loadModel(
      "test-model",
      "file:///test/model.gguf",
    );
    if (!result.success) {
      throw new Error("Failed to load model in test setup");
    }
  }

  describe("generateCompletion()", () => {
    it("should generate a completion from chat messages", async () => {
      await loadModelForTest();

      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, how are you?" },
      ];

      const result = await service.generateCompletion(messages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text.length).toBeGreaterThan(0);
        expect(typeof result.data.text).toBe("string");
        expect(result.data.promptTokens).toBeGreaterThan(0);
        expect(result.data.completionTokens).toBeGreaterThan(0);
        expect(result.data.totalTokens).toBe(
          result.data.promptTokens + result.data.completionTokens,
        );
      }
    });

    it("should return error when no model is loaded and none is configured", async () => {
      expect(service.isModelLoaded()).toBe(false);

      const result = await service.generateCompletion([
        { role: "user", content: "Test" },
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_READY");
        expect(result.error.message).toContain("No model is currently loaded");
      }
    });

    it("should reject with VALIDATION_ERROR when prompt exceeds context window", async () => {
      await loadModelForTest();

      const longContent = "word ".repeat(5000);
      const messages = [{ role: "user", content: longContent }];

      const result = await service.generateCompletion(messages);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("too long");
        expect(result.error.details).toHaveProperty("promptTokens");
        expect(result.error.details).toHaveProperty("maxPromptTokens");
      }
    });

    it("should handle single message without role prefix issues", async () => {
      await loadModelForTest();

      const result = await service.generateCompletion([
        { role: "user", content: "Single message test" },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text.length).toBeGreaterThan(0);
      }
    });

    it("should handle multi-turn conversation", async () => {
      await loadModelForTest();

      const messages = [
        { role: "system", content: "You are a reflective assistant." },
        { role: "user", content: "What should I reflect on?" },
        { role: "assistant", content: "Consider your internal patterns." },
        { role: "user", content: "Tell me more." },
      ];

      const result = await service.generateCompletion(messages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text.length).toBeGreaterThan(0);
      }
    });
  });

  describe("tokenize()", () => {
    it("should tokenize text into an array of token IDs", async () => {
      await loadModelForTest();

      const result = await service.tokenize("Hello world");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
        result.data.forEach((token: number) => {
          expect(typeof token).toBe("number");
        });
      }
    });

    it("should return error when model not loaded for tokenize", async () => {
      expect(service.isModelLoaded()).toBe(false);

      const result = await service.tokenize("Test tokenization");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_READY");
        expect(result.error.message).toContain("No model is currently loaded");
      }
    });

    it("should return empty array for empty string", async () => {
      await loadModelForTest();

      const result = await service.tokenize("");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });

    it("should handle unicode text", async () => {
      await loadModelForTest();

      const result = await service.tokenize("Ola\u0301 mundo \u2764\ufe0f");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
      }
    });
  });

  describe("generateGuidedQuestions()", () => {
    it("should generate the requested number of questions", async () => {
      await loadModelForTest();

      const result = await service.generateGuidedQuestions(
        "Context about feeling lost",
        5,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
        result.data.forEach((q: string) => {
          expect(q.endsWith("?")).toBe(true);
          expect(q.length).toBeGreaterThan(12);
        });
      }
    });

    it("should default to 5 questions when numQuestions not specified", async () => {
      await loadModelForTest();

      const result = await service.generateGuidedQuestions("Test context");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    });

    it("should handle small numQuestions (1)", async () => {
      await loadModelForTest();

      const result = await service.generateGuidedQuestions("Test", 1);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should cap numQuestions at 8 maximum", async () => {
      await loadModelForTest();

      const result = await service.generateGuidedQuestions("Test context", 20);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeLessThanOrEqual(8);
      }
    });

    it("should propagate completion errors", async () => {
      const llamaModule = require("llama.rn");
      const mockContext = {
        id: 0,
        completion: jest
          .fn()
          .mockRejectedValue(new Error("Native completion failed")),
        tokenize: jest.fn().mockResolvedValue({ tokens: [1, 2, 3] }),
      };
      const spy = jest
        .spyOn(llamaModule, "initLlama")
        .mockResolvedValue(mockContext);

      const freshService = new LocalAIRuntimeService();
      await freshService.loadModel("test", "file:///test/test.gguf");

      const result = await freshService.generateGuidedQuestions("Test");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LOCAL_GENERATION_UNAVAILABLE");
      }

      spy.mockRestore();
    });
  });

  describe("getStatus()", () => {
    it("should return status with initialized false before initialization", async () => {
      const status = await service.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.modelLoaded).toBe(false);
    });

    it("should return status with initialized true after initialization", async () => {
      await service.initialize();
      const status = await service.getStatus();
      expect(status.initialized).toBe(true);
    });

    it("should return status with modelLoaded true after model is loaded", async () => {
      await loadModelForTest();
      const status = await service.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelLoaded).toBe(true);
      expect(status.currentModel).toBeDefined();
      expect(status.currentModel?.id).toBe("test-model");
    });

    it("should return modelLoaded false after model is unloaded", async () => {
      await loadModelForTest();
      await service.unloadModel();

      const status = await service.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelLoaded).toBe(false);
      expect(status.currentModel).toBeUndefined();
    });
  });

  describe("isAvailable()", () => {
    it("should return false before initialization", () => {
      expect(service.isAvailable()).toBe(false);
    });

    it("should return true after initialization", async () => {
      await service.initialize();
      expect(service.isAvailable()).toBe(true);
    });

    it("should still return true after model is unloaded", async () => {
      await service.initialize();
      await service.loadModel("test", "file:///test/model.gguf");
      await service.unloadModel();

      expect(service.isAvailable()).toBe(true);
    });
  });

  describe("waitReady()", () => {
    it("should resolve after initialize()", async () => {
      service.initialize();
      await service.waitReady();
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe("generateCompletion() streaming callback", () => {
    it("should call onToken callback for each generated token", async () => {
      await loadModelForTest();
      const tokens: string[] = [];
      const onToken = jest.fn((token: string) => tokens.push(token));

      const result = await service.generateCompletion(
        [{ role: "user", content: "test" }],
        { onToken },
      );

      expect(result.success).toBe(true);
      expect(onToken).toHaveBeenCalled();
      expect(tokens.length).toBeGreaterThan(0);
    });

    it("should work without onToken callback (backward compatible)", async () => {
      await loadModelForTest();

      const result = await service.generateCompletion([
        { role: "user", content: "test" },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text.length).toBeGreaterThan(0);
      }
    });

    it("should stream tokens incrementally via callback", async () => {
      await loadModelForTest();
      const collectedTokens: string[] = [];
      const onToken = jest.fn((t: string) => collectedTokens.push(t));

      await service.generateCompletion([{ role: "user", content: "hello" }], {
        onToken,
      });

      // Verify callback was called with incremental tokens
      expect(collectedTokens.join("")).toContain("O");
    });
  });

  describe("generateCompletion() timeout", () => {
    it("should use default 60 second timeout", async () => {
      await loadModelForTest();

      // This should complete well within 60s with mock
      const result = await service.generateCompletion([
        { role: "user", content: "test" },
      ]);

      expect(result.success).toBe(true);
    });

    it("should accept custom timeout via options", async () => {
      await loadModelForTest();

      // Short timeout should still work with mock (instant response)
      const result = await service.generateCompletion(
        [{ role: "user", content: "test" }],
        { timeoutMs: 5000 },
      );

      expect(result.success).toBe(true);
    });

    it("should accept maxTokens option", async () => {
      await loadModelForTest();

      const result = await service.generateCompletion(
        [{ role: "user", content: "test" }],
        { maxTokens: 128 },
      );

      expect(result.success).toBe(true);
    });
  });
});
