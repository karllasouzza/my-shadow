/**
 * T038: Integration test for reflection -> guided questions generation flow
 *
 * Tests the full flow:
 * 1. Create reflection context
 * 2. Generate guided questions
 * 3. Validate output
 *
 * Covers normal mode (AI generation succeeds) and fallback mode (AI unavailable).
 */

import { GuidedQuestionSet } from "../../../features/reflection/model/guided-question-set";
import { ReflectionEntry } from "../../../features/reflection/model/reflection-entry";
import { ReflectionService } from "../../../features/reflection/service/reflection-service";
import type { GenerationJob } from "../../../shared/storage/generation-job-store";
import { createError, err, ok } from "../../../shared/utils/app-error";

// Mock llama.rn native module
jest.mock("llama.rn", () => require("../../__mocks__/llama.rn"));

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockRepository = {
  getById: jest.fn(),
  save: jest.fn(),
  saveQuestionSet: jest.fn(),
  getQuestionSetsByReflection: jest.fn(),
  deleteQuestionSet: jest.fn(),
  delete: jest.fn(),
};

const mockToneGuard = {
  validate: jest.fn(),
};

const mockFallbackProvider = {
  getGuidedQuestionsFallback: jest.fn(),
  getFinalReviewTemplateFallback: jest.fn(),
  getEmotionalTriggerPrompts: jest.fn(),
  getPatternIdentificationPrompts: jest.fn(),
  getCompleteFallbackSet: jest.fn(),
};

const mockRAGRepository = {
  initialize: jest.fn(),
  storeEmbedding: jest.fn(),
  search: jest.fn(),
  searchByText: jest.fn(),
  deleteEmbedding: jest.fn(),
  getEmbeddingsByDateRange: jest.fn(),
  clear: jest.fn(),
};

const mockLocalAIRuntime = {
  initialize: jest.fn(),
  waitReady: jest.fn(),
  loadModel: jest.fn(),
  generateCompletion: jest.fn(),
  generateGuidedQuestions: jest.fn(),
  getStatus: jest.fn(),
  isModelLoaded: jest.fn(),
  getCurrentModel: jest.fn(),
  tokenize: jest.fn(),
  unloadModel: jest.fn(),
  isAvailable: jest.fn(),
};

const mockJobStore = {
  createJob: jest.fn(),
  updateJob: jest.fn(),
  getJob: jest.fn(),
  getQueuedJobs: jest.fn(),
  deleteJob: jest.fn(),
  clear: jest.fn(),
};

const mockMetrics = {
  startTiming: jest.fn(),
  getSummary: jest.fn(),
  isWithinBudget: jest.fn(),
  setBudget: jest.fn(),
  getAllMetrics: jest.fn(),
  clear: jest.fn(),
  generateReport: jest.fn(),
};

jest.mock(
  "../../../features/reflection/repository/reflection-repository",
  () => ({
    getReflectionRepository: jest.fn(() => mockRepository),
  }),
);

jest.mock("../../../shared/ai/ptbr-tone-guard", () => ({
  getPtBRJungianGuard: jest.fn(() => mockToneGuard),
  getPtBRLanguageGuard: jest.fn(),
  getJungianToneGuard: jest.fn(),
  PtBRJungianGuard: jest.fn(),
  PtBRLanguageGuard: jest.fn(),
  JungianToneGuard: jest.fn(),
}));

jest.mock("../../../shared/ai/fallback-prompts-ptbr", () => ({
  getFallbackPromptProvider: jest.fn(() => mockFallbackProvider),
  FallbackPromptProvider: jest.fn(),
}));

jest.mock("../../../shared/ai/reflection-rag-repository", () => ({
  getReflectionRAGRepository: jest.fn(() => mockRAGRepository),
  ReflectionRAGRepository: jest.fn(),
}));

jest.mock("../../../shared/ai/local-ai-runtime", () => ({
  getLocalAIRuntime: jest.fn(() => mockLocalAIRuntime),
  LocalAIRuntimeService: jest.fn(),
}));

jest.mock("../../../shared/storage/generation-job-store", () => ({
  getGenerationJobStore: jest.fn(() => mockJobStore),
  GenerationJobStore: jest.fn(),
}));

jest.mock("../../../shared/utils/performance-metrics", () => ({
  getPerformanceMetrics: jest.fn(() => mockMetrics),
  PerformanceMetrics: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PORTUGUESE_QUESTIONS = [
  "O que voce sente quando observa suas sombras internas?",
  "Como de suas emocoes se manifestam em momentos de silencio?",
  "Qual e o padrao que voce nota em suas interacoes?",
  "O que sua intuicao diz sobre este momento?",
  "Como de voce pode integrar este aspecto em sua jornada?",
];

const FALLBACK_QUESTIONS = [
  "O que voce sente em relacao ao que escreveu?",
  "Existem padroes que voce reconhece nesta reflexao?",
  "Como voce poderia responder com compaixao a isso?",
  "O que este sentimento esta tentando lhe dizer?",
];

const TONE_VALID_PASS = ok({
  language: { isPtBR: true, confidence: 0.9 },
  tone: { isValid: true, score: 0.8, issues: [] },
});

const MOCK_MODEL = {
  id: "qwen2.5-0.5b-quantized",
  name: "qwen2.5-0.5b-quantized",
  path: "file://qwen2.5-0.5b-quantized.gguf",
  sizeBytes: 0,
  contextLength: 4096,
  isLoaded: true,
};

function stopTimingNoop(): void {
  // no-op
}

function createReflectionEntry(
  content: string = "Hoje refleti sobre meus medos e percebo que posso enfrenta-los.",
  entryDate: string = "2026-04-09",
): ReflectionEntry {
  const result = ReflectionEntry.create(content, entryDate, ["introspectivo"]);
  if (!result.success) throw new Error("Failed to create test reflection");
  return result.data;
}

function setupCommonMocks(): void {
  mockMetrics.startTiming.mockReturnValue(stopTimingNoop);
  mockRAGRepository.initialize.mockResolvedValue(ok(undefined));
  mockRAGRepository.searchByText.mockResolvedValue(ok([]));
  mockRepository.saveQuestionSet.mockResolvedValue(ok(undefined));
  mockToneGuard.validate.mockReturnValue(TONE_VALID_PASS);
  mockLocalAIRuntime.getCurrentModel.mockReturnValue(MOCK_MODEL);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Reflection -> Guided Questions Integration Flow", () => {
  let service: ReflectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    setupCommonMocks();
    service = new ReflectionService();
  });

  // -----------------------------------------------------------------------
  // Normal mode flow
  // -----------------------------------------------------------------------

  describe("normal mode – full flow with AI generation", () => {
    beforeEach(() => {
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
    });

    it("should complete full flow: create reflection -> generate questions -> validate output", async () => {
      const entry = createReflectionEntry(
        "Hoje percebi que meus medos me impedem de agir com autenticidade.",
      );
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      // Flow completed successfully
      expect(result.success).toBe(true);
      if (result.success) {
        const { questionSet } = result.data;

        // Output validation
        expect(questionSet.reflectionId).toBe(entry.id);
        expect(questionSet.questions).toEqual(PORTUGUESE_QUESTIONS);
        expect(questionSet.generationMode).toBe("normal");
        expect(questionSet.questions.length).toBeGreaterThan(0);
        expect(questionSet.questions.length).toBeLessThanOrEqual(8);
        expect(questionSet.modelId).toBe("qwen2.5-0.5b-quantized");
        expect(questionSet.generatedAt).toBeDefined();

        // Should have been persisted
        expect(mockRepository.saveQuestionSet).toHaveBeenCalled();
      }
    });

    it("should include RAG context when available", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));

      mockRAGRepository.searchByText.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_ctx_1",
            score: 0.88,
            text: "Reflexao anterior sobre medos.",
            entryDate: "2026-04-05",
          },
        ]),
      );
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.retrievalContextReflectionIds).toContain(
          entry.id,
        );
        expect(result.data.questionSet.retrievalContextReflectionIds).toContain(
          "ref_ctx_1",
        );
        expect(
          result.data.questionSet.retrievalContextReflectionIds.length,
        ).toBeGreaterThan(1);
      }
    });

    it("should track performance timing", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );

      await service.generateGuidedQuestions(entry.id);

      expect(mockMetrics.startTiming).toHaveBeenCalledWith(
        "generate_guided_questions",
      );
    });

    it("should not queue retry job in normal mode", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.queuedRetryJobId).toBeUndefined();
      }
      // Should NOT have created a retry job
      expect(mockJobStore.createJob).not.toHaveBeenCalled();
    });

    it("should validate generated questions through tone guard", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );

      await service.generateGuidedQuestions(entry.id);

      // Tone guard should be called for content + each generated question
      expect(mockToneGuard.validate).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Fallback mode flow
  // -----------------------------------------------------------------------

  describe("fallback mode – AI unavailable", () => {
    beforeEach(() => {
      mockFallbackProvider.getGuidedQuestionsFallback.mockReturnValue(
        FALLBACK_QUESTIONS,
      );
      mockJobStore.createJob.mockResolvedValue(
        ok({
          id: "job_retry_fb_001",
          targetType: "guided_questions",
          targetRefId: "ref_001",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as GenerationJob),
      );
    });

    it("should complete flow with fallback when AI init fails", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(
        err(createError("NOT_READY", "Local AI runtime unavailable")),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        const { questionSet, queuedRetryJobId } = result.data;

        expect(questionSet.questions).toEqual(FALLBACK_QUESTIONS);
        expect(questionSet.generationMode).toBe("fallback_template");
        expect(questionSet.reflectionId).toBe(entry.id);
        expect(queuedRetryJobId).toBe("job_retry_fb_001");
      }
    });

    it("should complete flow with fallback when AI returns empty", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(ok([]));

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.generationMode).toBe(
          "fallback_template",
        );
        expect(result.data.questionSet.questions).toEqual(FALLBACK_QUESTIONS);
        expect(result.data.queuedRetryJobId).toBeDefined();
      }
    });

    it("should complete flow with fallback when AI generation errors", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        err(createError("LOCAL_GENERATION_UNAVAILABLE", "Generation failed")),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.generationMode).toBe(
          "fallback_template",
        );
      }
    });

    it("should queue retry job for later proper generation", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(
        err(createError("NOT_READY", "Runtime unavailable")),
      );

      await service.generateGuidedQuestions(entry.id);

      expect(mockJobStore.createJob).toHaveBeenCalledWith(
        "guided_questions",
        entry.id,
        3,
      );
    });

    it("should persist fallback question set to storage", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(
        err(createError("NOT_READY", "Runtime unavailable")),
      );

      await service.generateGuidedQuestions(entry.id);

      expect(mockRepository.saveQuestionSet).toHaveBeenCalled();
    });

    it("should track performance timing in fallback mode", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(
        err(createError("NOT_READY", "Runtime unavailable")),
      );

      await service.generateGuidedQuestions(entry.id);

      expect(mockMetrics.startTiming).toHaveBeenCalledWith(
        "generate_guided_questions",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Error flow
  // -----------------------------------------------------------------------

  describe("error flow – reflection not found or storage failures", () => {
    it("should return error when reflection does not exist", async () => {
      mockRepository.getById.mockResolvedValue(ok(null));

      const result = await service.generateGuidedQuestions("nonexistent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.details?.reflectionId).toBe("nonexistent");
      }
    });

    it("should return error when repository getById throws", async () => {
      mockRepository.getById.mockResolvedValue(
        err(createError("STORAGE_ERROR", "Database error", {})),
      );

      const result = await service.generateGuidedQuestions("some_id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STORAGE_ERROR");
      }
    });

    it("should return error when question set save fails in normal mode", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );
      mockRepository.saveQuestionSet.mockResolvedValue(
        err(createError("STORAGE_ERROR", "Save failed", {})),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STORAGE_ERROR");
      }
    });

    it("should return error when question set save fails in fallback mode", async () => {
      const entry = createReflectionEntry();
      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(
        err(createError("NOT_READY", "Runtime unavailable")),
      );
      mockFallbackProvider.getGuidedQuestionsFallback.mockReturnValue(
        FALLBACK_QUESTIONS,
      );
      mockRepository.saveQuestionSet.mockResolvedValue(
        err(createError("STORAGE_ERROR", "Save failed", {})),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(false);
    });

    it("should return error on unexpected exception", async () => {
      mockRepository.getById.mockRejectedValue(new Error("Unexpected crash"));

      const result = await service.generateGuidedQuestions("some_id");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("LOCAL_GENERATION_UNAVAILABLE");
        expect(result.error.message).toBe(
          "Failed to generate guided questions",
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // Full end-to-end scenarios with mocked services
  // -----------------------------------------------------------------------

  describe("end-to-end scenarios with mocked services", () => {
    it("should handle scenario: fresh reflection with AI generation", async () => {
      // Setup
      const entry = createReflectionEntry(
        "Inicio minha jornada de autoconhecimento. Sinto-me perdido mas curioso.",
        "2026-04-09",
      );

      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok([
          "O que curiosidade revela sobre sua jornada?",
          "Como o sentimento de perda se conecta com seu desejo de conhecer-se?",
          "Qual aspecto de si mesmo mais pede atencao?",
        ]),
      );

      // Execute
      const result = await service.generateGuidedQuestions(entry.id);

      // Validate
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.questions).toHaveLength(3);
        expect(result.data.questionSet.generationMode).toBe("normal");
        expect(result.data.queuedRetryJobId).toBeUndefined();

        // Verify questions are in Portuguese
        for (const q of result.data.questionSet.questions) {
          expect(q).toMatch(/[aoeiu]/);
          expect(q.endsWith("?")).toBe(true);
        }
      }
    });

    it("should handle scenario: reflection with RAG context enrichment", async () => {
      const entry = createReflectionEntry(
        "Reconheco padroes repetitivos em minhas relacoes.",
        "2026-04-09",
      );

      mockRepository.getById.mockResolvedValue(ok(entry));

      // RAG finds related past reflections
      mockRAGRepository.searchByText.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_past_1",
            score: 0.91,
            text: "Sempre repito os mesmos erros nas relacoes.",
            entryDate: "2026-03-20",
          },
          {
            reflectionId: "ref_past_2",
            score: 0.76,
            text: "Preciso entender porque atraio as mesmas situacoes.",
            entryDate: "2026-04-01",
          },
        ]),
      );

      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok([
          "Que padrao relacional voce mais deseja transformar?",
          "Como de suas experiencias passadas informam o presente?",
          "O que suas relacoes revelam sobre sua sombra?",
        ]),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.retrievalContextReflectionIds).toContain(
          "ref_past_1",
        );
        expect(result.data.questionSet.retrievalContextReflectionIds).toContain(
          "ref_past_2",
        );
        expect(
          result.data.questionSet.retrievalContextReflectionIds.length,
        ).toBe(3); // current + 2 context
      }
    });

    it("should handle scenario: AI fails midway, graceful fallback", async () => {
      const entry = createReflectionEntry(
        "Hoje foi dificil. Sinto que nao consigo progredir.",
        "2026-04-09",
      );

      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      // Generation returns empty (model could not produce output)
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(ok([]));
      mockFallbackProvider.getGuidedQuestionsFallback.mockReturnValue(
        FALLBACK_QUESTIONS,
      );
      mockJobStore.createJob.mockResolvedValue(
        ok({
          id: "job_retry_midway",
          targetType: "guided_questions",
          targetRefId: entry.id,
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as GenerationJob),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.generationMode).toBe(
          "fallback_template",
        );
        expect(result.data.questionSet.questions).toEqual(FALLBACK_QUESTIONS);
        expect(result.data.queuedRetryJobId).toBe("job_retry_midway");
      }
    });

    it("should handle scenario: tone validation rejects generated questions", async () => {
      const entry = createReflectionEntry(
        "Sinto raiva de mim mesmo por nao conseguir mudar.",
        "2026-04-09",
      );

      mockRepository.getById.mockResolvedValue(ok(entry));
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));

      // AI generates questions but tone guard rejects them
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(["Por que voce e tao fraco?", "Voce nunca vai mudar isso."]),
      );

      let validateCallCount = 0;
      mockToneGuard.validate.mockImplementation(() => {
        validateCallCount++;
        // First call (content) passes, subsequent calls (generated questions) fail
        if (validateCallCount <= 1) {
          return TONE_VALID_PASS;
        }
        return err(
          createError(
            "VALIDATION_ERROR",
            "Content does not maintain appropriate introspective tone",
          ),
        );
      });

      mockFallbackProvider.getGuidedQuestionsFallback.mockReturnValue(
        FALLBACK_QUESTIONS,
      );

      const result = await service.generateGuidedQuestions(entry.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.generationMode).toBe(
          "fallback_template",
        );
        expect(result.data.questionSet.questions).toEqual(FALLBACK_QUESTIONS);
      }
    });

    it("should handle scenario: RAG init fails, falls back to normal generation", async () => {
      const entry = createReflectionEntry();

      mockRepository.getById.mockResolvedValue(ok(entry));
      mockRAGRepository.initialize.mockResolvedValue(
        err(createError("NOT_READY", "RAG vector store unavailable", {})),
      );
      mockLocalAIRuntime.initialize.mockResolvedValue(ok(undefined));
      mockLocalAIRuntime.waitReady.mockResolvedValue(undefined);
      mockLocalAIRuntime.loadModel.mockResolvedValue(ok(MOCK_MODEL));
      mockLocalAIRuntime.generateGuidedQuestions.mockResolvedValue(
        ok(PORTUGUESE_QUESTIONS),
      );

      const result = await service.generateGuidedQuestions(entry.id);

      // Should still succeed without RAG context
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questionSet.generationMode).toBe("normal");
        expect(result.data.questionSet.questions).toEqual(PORTUGUESE_QUESTIONS);
        // Only the reflection ID itself should be in context
        expect(result.data.questionSet.retrievalContextReflectionIds).toEqual([
          entry.id,
        ]);
      }
    });
  });

  // -----------------------------------------------------------------------
  // GuidedQuestionSet integration validation
  // -----------------------------------------------------------------------

  describe("GuidedQuestionSet integration validation", () => {
    it("should create valid question set from normal mode output", () => {
      const result = GuidedQuestionSet.create(
        "ref_001",
        PORTUGUESE_QUESTIONS,
        "normal",
        ["ref_001", "ref_ctx_1"],
        "qwen2.5-0.5b-quantized",
        "llama.rn-0.10",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data.toData();
        expect(data.reflectionId).toBe("ref_001");
        expect(data.generationMode).toBe("normal");
        expect(data.questions).toEqual(PORTUGUESE_QUESTIONS);
        expect(data.retrievalContextReflectionIds).toEqual([
          "ref_001",
          "ref_ctx_1",
        ]);
        expect(data.modelId).toBe("qwen2.5-0.5b-quantized");
        expect(data.modelVersion).toBe("llama.rn-0.10");
        expect(data.generatedAt).toBeDefined();
      }
    });

    it("should create valid question set from fallback mode output", () => {
      const result = GuidedQuestionSet.create(
        "ref_001",
        FALLBACK_QUESTIONS,
        "fallback_template",
        ["ref_001"],
        "fallback",
        "template-v1",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isFallback()).toBe(true);
        expect(result.data.isRetry()).toBe(false);
      }
    });
  });
});
