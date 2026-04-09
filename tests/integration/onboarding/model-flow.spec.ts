/**
 * T027: Integration test for model download -> load -> generate flow
 *
 * Tests the complete lifecycle of initializing the runtime, loading a model,
 * generating completions, and cleaning up. Uses mocked llama.rn module.
 */

import { describe, expect, it } from "bun:test";
import {
  LocalAIRuntimeService,
  getLocalAIRuntime,
} from "../../../shared/ai/local-ai-runtime";

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: jest.fn((obj) => obj.ios ?? obj.default) },
  NativeModules: {},
  AppState: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
}));

describe("T027: Integration - Model Download -> Load -> Generate Flow", () => {
  let service: LocalAIRuntimeService;

  beforeEach(() => {
    service = new LocalAIRuntimeService();
  });

  afterEach(async () => {
    try {
      await service.unloadModel();
    } catch {
      // ignore cleanup errors
    }
    jest.clearAllMocks();
  });

  describe("Complete model lifecycle flow", () => {
    it("should complete full flow: initialize -> load -> generate -> unload", async () => {
      const initResult = await service.initialize();
      expect(initResult.success).toBe(true);
      expect(service.isAvailable()).toBe(true);

      const loadResult = await service.loadModel(
        "qwen2.5-0.5b-q4",
        "file:///data/models/qwen2.5-0.5b-q4.gguf",
      );
      expect(loadResult.success).toBe(true);
      expect(service.isModelLoaded()).toBe(true);

      const completionResult = await service.generateCompletion([
        { role: "system", content: "You are a reflective assistant." },
        { role: "user", content: "Help me reflect on my journal entry." },
      ]);
      expect(completionResult.success).toBe(true);
      if (completionResult.success) {
        expect(completionResult.data.text.length).toBeGreaterThan(0);
        expect(completionResult.data.promptTokens).toBeGreaterThan(0);
        expect(completionResult.data.completionTokens).toBeGreaterThan(0);
      }

      const unloadResult = await service.unloadModel();
      expect(unloadResult.success).toBe(true);
      expect(service.isModelLoaded()).toBe(false);
      expect(service.getCurrentModel()).toBeNull();
    });

    it("should handle multiple generate calls with same loaded model", async () => {
      await service.initialize();
      await service.loadModel("model-a", "file:///test/model-a.gguf");

      const first = await service.generateCompletion([
        { role: "user", content: "First prompt" },
      ]);
      const second = await service.generateCompletion([
        { role: "user", content: "Second prompt" },
      ]);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      if (first.success && second.success) {
        expect(first.data.text.length).toBeGreaterThan(0);
        expect(second.data.text.length).toBeGreaterThan(0);
      }
    });

    it("should handle model switch: unload old, load new, generate", async () => {
      await service.initialize();

      const loadA = await service.loadModel(
        "model-a",
        "file:///test/model-a.gguf",
      );
      expect(loadA.success).toBe(true);

      const genA = await service.generateCompletion([
        { role: "user", content: "Test with model A" },
      ]);
      expect(genA.success).toBe(true);

      const loadB = await service.loadModel(
        "model-b",
        "file:///test/model-b.gguf",
      );
      expect(loadB.success).toBe(true);
      if (loadB.success) {
        expect(loadB.data.id).toBe("model-b");
      }

      const genB = await service.generateCompletion([
        { role: "user", content: "Test with model B" },
      ]);
      expect(genB.success).toBe(true);
    });

    it("should handle tokenize -> generate pipeline", async () => {
      await service.initialize();
      await service.loadModel("test-model", "file:///test/model.gguf");

      const tokenizeResult = await service.tokenize("Hello world test");
      expect(tokenizeResult.success).toBe(true);
      if (tokenizeResult.success) {
        expect(tokenizeResult.data.length).toBeGreaterThan(0);
      }

      const genResult = await service.generateCompletion([
        { role: "user", content: "Hello world test" },
      ]);
      expect(genResult.success).toBe(true);
      if (genResult.success) {
        expect(genResult.data.text.length).toBeGreaterThan(0);
      }
    });

    it("should handle guided questions pipeline", async () => {
      await service.initialize();
      await service.loadModel("test-model", "file:///test/model.gguf");

      const journalEntry =
        "Today I felt overwhelmed by emotions I cannot quite name.";

      const questionsResult = await service.generateGuidedQuestions(
        journalEntry,
        5,
      );
      expect(questionsResult.success).toBe(true);
      if (questionsResult.success) {
        expect(questionsResult.data.length).toBeGreaterThan(0);
        questionsResult.data.forEach((q: string) => {
          expect(q.endsWith("?")).toBe(true);
        });
      }
    });
  });

  describe("Error recovery and edge cases", () => {
    it("should recover after unload by loading again", async () => {
      await service.initialize();

      const firstLoad = await service.loadModel(
        "model-a",
        "file:///test/model-a.gguf",
      );
      expect(firstLoad.success).toBe(true);

      await service.unloadModel();
      expect(service.isModelLoaded()).toBe(false);

      const secondLoad = await service.loadModel(
        "model-b",
        "file:///test/model-b.gguf",
      );
      expect(secondLoad.success).toBe(true);
      if (secondLoad.success) {
        expect(secondLoad.data.id).toBe("model-b");
      }
    });

    it("should handle generate call on unloaded model by auto-loading default", async () => {
      expect(service.isModelLoaded()).toBe(false);

      const result = await service.generateCompletion([
        { role: "user", content: "Auto-load test" },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text.length).toBeGreaterThan(0);
      }
      expect(service.isModelLoaded()).toBe(true);
    });

    it("should handle generate call after explicit unload (re-auto-load)", async () => {
      await service.loadModel("test", "file:///test/test.gguf");
      expect(service.isModelLoaded()).toBe(true);

      await service.unloadModel();
      expect(service.isModelLoaded()).toBe(false);

      const result = await service.generateCompletion([
        { role: "user", content: "Re-auto-load test" },
      ]);

      expect(result.success).toBe(true);
      expect(service.isModelLoaded()).toBe(true);
    });

    it("should handle consecutive unload calls gracefully", async () => {
      await service.loadModel("test", "file:///test/test.gguf");

      const first = await service.unloadModel();
      const second = await service.unloadModel();
      const third = await service.unloadModel();

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(third.success).toBe(true);
    });

    it("should handle empty message content", async () => {
      await service.initialize();
      await service.loadModel("test", "file:///test/test.gguf");

      const result = await service.generateCompletion([
        { role: "user", content: "" },
      ]);

      expect(result.success).toBe(true);
    });

    it("should handle generate with multi-turn messages", async () => {
      await service.initialize();
      await service.loadModel("test", "file:///test/test.gguf");

      const result = await service.generateCompletion([
        { role: "assistant", content: "Previous assistant message" },
        { role: "user", content: "User follow-up" },
        { role: "assistant", content: "Previous response" },
        { role: "user", content: "Final question" },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Status tracking across lifecycle", () => {
    it("should track status changes through the full lifecycle", async () => {
      let status = await service.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.modelLoaded).toBe(false);

      await service.initialize();
      status = await service.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelLoaded).toBe(false);

      await service.loadModel("test", "file:///test/test.gguf");
      status = await service.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelLoaded).toBe(true);
      expect(status.currentModel?.id).toBe("test");

      await service.unloadModel();
      status = await service.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelLoaded).toBe(false);
      expect(status.currentModel).toBeUndefined();
    });
  });

  describe("Singleton behavior", () => {
    it("should return the same instance from getLocalAIRuntime()", () => {
      const instance1 = getLocalAIRuntime();
      const instance2 = getLocalAIRuntime();

      expect(instance1).toBe(instance2);
    });

    it("should share state across getLocalAIRuntime() calls", async () => {
      const serviceA = getLocalAIRuntime();
      await serviceA.initialize();
      await serviceA.loadModel("singleton-test", "file:///test/singleton.gguf");

      const serviceB = getLocalAIRuntime();
      expect(serviceB.isModelLoaded()).toBe(true);
      expect(serviceB.getCurrentModel()?.id).toBe("singleton-test");
    });
  });
});
