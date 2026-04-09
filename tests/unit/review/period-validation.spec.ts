/**
 * T048: Unit tests for empty period handling (insufficient material)
 *
 * Tests:
 * - 0 reflections: should return error
 * - 1 reflection: should generate minimal review
 * - Date range with no reflections
 * - User-friendly error messages in pt-BR
 */

// llama.rn is auto-mocked via moduleNameMapper in jest.config.ts

jest.mock("react-native-mmkv", () => ({
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
    clearAll: jest.fn(),
    isEncrypted: false,
    encrypt: jest.fn(),
  })),
}));

jest.mock("expo-crypto", () => ({
  getRandomBytes: jest.fn((length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = i;
    return bytes;
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));

jest.mock("../../../shared/storage/encrypted-reflection-store", () => {
  const mockStore = {
    saveReflection: jest
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getReflection: jest.fn().mockResolvedValue({ success: true, data: null }),
    getAllReflections: jest.fn().mockResolvedValue({ success: true, data: [] }),
    deleteReflection: jest
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    saveQuestionSet: jest
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getQuestionSetsByReflection: jest
      .fn()
      .mockResolvedValue({ success: true, data: [] }),
    deleteQuestionSet: jest
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    saveFinalReview: jest
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    getFinalReviewsByPeriod: jest
      .fn()
      .mockResolvedValue({ success: true, data: [] }),
    deleteFinalReview: jest
      .fn()
      .mockResolvedValue({ success: true, data: undefined }),
    clear: jest.fn().mockResolvedValue({ success: true, data: undefined }),
  };
  return {
    initReflectionStore: jest.fn(),
    getReflectionStore: jest.fn(() => mockStore),
    EncryptedReflectionStore: jest.fn(),
  };
});

import { ReflectionEntry } from "../../../features/reflection/model/reflection-entry";
import { ReviewService } from "../../../features/review/service/review-service";
import { FallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import { PtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import { createError, err, ok } from "../../../shared/utils/app-error";

function createReviewService(deps: {
  reflectionRepository: any;
  reviewRepository: any;
  jobStore: any;
}) {
  const service = new ReviewService();
  (service as any).reflectionRepository = deps.reflectionRepository;
  (service as any).reviewRepository = deps.reviewRepository;
  (service as any).fallbackProvider = new FallbackPromptProvider();
  (service as any).toneGuard = new PtBRJungianGuard();
  (service as any).jobStore = deps.jobStore;
  return service;
}

describe("T048: Empty Period Handling", () => {
  let reflectionRepository: any;
  let reviewRepository: any;
  let jobStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    reviewRepository = { save: jest.fn().mockResolvedValue(ok(undefined)) };
    jobStore = {
      createJob: jest.fn().mockResolvedValue(
        ok({
          id: "job_test",
          targetType: "final_review" as const,
          targetRefId: "review_test",
          status: "queued" as const,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    };
  });

  describe("0 reflections - empty period", () => {
    it("should return VALIDATION_ERROR when reflectionIds array is empty", async () => {
      reflectionRepository = { getById: jest.fn().mockResolvedValue(ok(null)) };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        [],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe(
          "Nenhuma reflexao encontrada no periodo selecionado para gerar revisao.",
        );
      }
    });

    it("should return NOT_FOUND when all referenced reflections have no content", async () => {
      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(
          ok(
            new ReflectionEntry({
              id: "ref_empty",
              entryDate: "2026-04-01",
              content: "",
              sourceLocale: "pt-BR",
              createdAt: "2026-04-01T10:00:00.000Z",
              updatedAt: "2026-04-01T10:00:00.000Z",
            }),
          ),
        ),
      };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        ["ref_empty"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain(
          "Nenhum conteudo de reflexao disponivel",
        );
        expect(result.error.details).toHaveProperty(
          "periodStart",
          "2026-04-01",
        );
        expect(result.error.details).toHaveProperty("periodEnd", "2026-04-30");
      }
    });

    it("should return NOT_FOUND when reflections have whitespace-only content", async () => {
      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(
          ok(
            new ReflectionEntry({
              id: "ref_ws",
              entryDate: "2026-04-01",
              content: "   \n\t  ",
              sourceLocale: "pt-BR",
              createdAt: "2026-04-01T10:00:00.000Z",
              updatedAt: "2026-04-01T10:00:00.000Z",
            }),
          ),
        ),
      };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        ["ref_ws"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("1 reflection - minimal review", () => {
    it("should generate a minimal review with a single reflection", async () => {
      const singleReflection = new ReflectionEntry({
        id: "ref_single",
        entryDate: "2026-04-15",
        content:
          "Hoje tive uma breve reflexao sobre meus sentimentos. Senti ansiedade durante o dia.",
        moodTags: ["ansioso"],
        triggerTags: ["emocoes"],
        sourceLocale: "pt-BR",
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:00:00.000Z",
      });

      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(ok(singleReflection)),
      };
      const mockRuntime = {
        initialize: jest.fn().mockResolvedValue(ok(undefined)),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest
          .fn()
          .mockResolvedValue(
            ok({ id: "qwen2.5-0.5b-quantized", isLoaded: true }),
          ),
        generateCompletion: jest.fn().mockResolvedValue(
          ok({
            text: "RESUMO:\nReflexao unica sobre ansiedade.\n\nPADROES:\n- Observacao\n\nGATILHOS:\n- Ansiedade\n\nPROMPTS:\n- Como cuidar melhor?",
            promptTokens: 30,
            completionTokens: 50,
            totalTokens: 80,
          }),
        ),
        getCurrentModel: jest
          .fn()
          .mockReturnValue({ id: "qwen2.5-0.5b-quantized" }),
      };
      jest
        .spyOn(
          require("../../../shared/ai/local-ai-runtime"),
          "getLocalAIRuntime",
        )
        .mockReturnValue(mockRuntime);

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-15",
        "2026-04-15",
        ["ref_single"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary.length).toBeGreaterThan(0);
        expect(result.data.prompts.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should use concise fallback message for single reflection when AI fails", async () => {
      const singleReflection = new ReflectionEntry({
        id: "ref_single_ai_fail",
        entryDate: "2026-04-15",
        content: "Reflexao breve sobre o dia.",
        moodTags: [],
        triggerTags: [],
        sourceLocale: "pt-BR",
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:00:00.000Z",
      });

      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(ok(singleReflection)),
      };
      const mockRuntime = {
        initialize: jest
          .fn()
          .mockResolvedValue(
            err(createError("NOT_READY", "Runtime not available")),
          ),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest.fn(),
        generateCompletion: jest.fn(),
        getCurrentModel: jest.fn().mockReturnValue(null),
      };
      jest
        .spyOn(
          require("../../../shared/ai/local-ai-runtime"),
          "getLocalAIRuntime",
        )
        .mockReturnValue(mockRuntime);

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-15",
        "2026-04-15",
        ["ref_single_ai_fail"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toContain("2026-04-15");
        expect(result.data.summary.toLowerCase()).toMatch(
          /(poucos dados|ponto importante|aprofundamento)/i,
        );
      }
    });

    it("should generate fewer patterns/triggers for single reflection via fallback", async () => {
      const singleReflection = new ReflectionEntry({
        id: "ref_single_minimal",
        entryDate: "2026-04-20",
        content: "Dia tranquilo, sem muitas reflexoes.",
        moodTags: ["calmo"],
        triggerTags: [],
        sourceLocale: "pt-BR",
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:00:00.000Z",
      });

      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(ok(singleReflection)),
      };
      const mockRuntime = {
        initialize: jest
          .fn()
          .mockResolvedValue(err(createError("NOT_READY", "AI unavailable"))),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest.fn(),
        generateCompletion: jest.fn(),
        getCurrentModel: jest.fn().mockReturnValue(null),
      };
      jest
        .spyOn(
          require("../../../shared/ai/local-ai-runtime"),
          "getLocalAIRuntime",
        )
        .mockReturnValue(mockRuntime);

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-20",
        "2026-04-20",
        ["ref_single_minimal"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.patterns.length).toBeLessThanOrEqual(3);
        expect(result.data.triggers.length).toBeLessThanOrEqual(3);
        expect(result.data.prompts.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("date range with no reflections", () => {
    it("should return NOT_FOUND when no reflections exist in the date range", async () => {
      reflectionRepository = { getById: jest.fn().mockResolvedValue(ok(null)) };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-01-01",
        "2026-01-31",
        ["nonexistent_ref_1", "nonexistent_ref_2"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain(
          "Nenhum conteudo de reflexao disponivel",
        );
      }
    });

    it("should handle mixed existing and non-existing reflection IDs gracefully", async () => {
      const validReflection = new ReflectionEntry({
        id: "ref_valid",
        entryDate: "2026-04-10",
        content: "Reflexao valida sobre padroes internos.",
        moodTags: ["reflexivo"],
        triggerTags: ["padroes"],
        sourceLocale: "pt-BR",
        createdAt: "2026-04-10T10:00:00.000Z",
        updatedAt: "2026-04-10T10:00:00.000Z",
      });

      reflectionRepository = {
        getById: jest.fn().mockImplementation(async (id: string) => {
          return id === "ref_valid" ? ok(validReflection) : ok(null);
        }),
      };
      const mockRuntime = {
        initialize: jest
          .fn()
          .mockResolvedValue(err(createError("NOT_READY", "AI unavailable"))),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest.fn(),
        generateCompletion: jest.fn(),
        getCurrentModel: jest.fn().mockReturnValue(null),
      };
      jest
        .spyOn(
          require("../../../shared/ai/local-ai-runtime"),
          "getLocalAIRuntime",
        )
        .mockReturnValue(mockRuntime);

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-10",
        "2026-04-10",
        ["ref_valid", "nonexistent_1", "nonexistent_2"],
      );

      expect(result.success).toBe(true);
    });
  });

  describe("user-friendly error messages in pt-BR", () => {
    it("should return descriptive error when reflectionIds is empty", async () => {
      reflectionRepository = { getById: jest.fn().mockResolvedValue(ok(null)) };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        [],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message.length).toBeGreaterThan(10);
      }
    });

    it("should return error with period context when content is unavailable", async () => {
      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(
          ok(
            new ReflectionEntry({
              id: "ref_empty_content",
              entryDate: "2026-04-01",
              content: "",
              sourceLocale: "pt-BR",
              createdAt: "2026-04-01T10:00:00.000Z",
              updatedAt: "2026-04-01T10:00:00.000Z",
            }),
          ),
        ),
      };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        ["ref_empty_content"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.details).toHaveProperty("periodStart");
        expect(result.error.details).toHaveProperty("periodEnd");
      }
    });

    it("should handle storage error when review save throws an exception", async () => {
      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(
          ok(
            new ReflectionEntry({
              id: "ref_save_error",
              entryDate: "2026-04-01",
              content: "Conteudo valido para teste.",
              sourceLocale: "pt-BR",
              createdAt: "2026-04-01T10:00:00.000Z",
              updatedAt: "2026-04-01T10:00:00.000Z",
            }),
          ),
        ),
      };
      reviewRepository = {
        save: jest.fn().mockImplementation(async () => {
          throw new Error(
            "Falha ao salvar revisao no armazenamento criptografado",
          );
        }),
      };
      const mockRuntime = {
        initialize: jest.fn().mockResolvedValue(ok(undefined)),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest
          .fn()
          .mockResolvedValue(
            ok({ id: "qwen2.5-0.5b-quantized", isLoaded: true }),
          ),
        generateCompletion: jest.fn().mockResolvedValue(
          ok({
            text: "RESUMO:\nConteudo para teste de salvamento.\n\nPADROES:\n- Padrao teste\n\nGATILHOS:\n- Gatilho teste\n\nPROMPTS:\n- Como melhorar?",
            promptTokens: 20,
            completionTokens: 40,
            totalTokens: 60,
          }),
        ),
        getCurrentModel: jest
          .fn()
          .mockReturnValue({ id: "qwen2.5-0.5b-quantized" }),
      };
      jest
        .spyOn(
          require("../../../shared/ai/local-ai-runtime"),
          "getLocalAIRuntime",
        )
        .mockReturnValue(mockRuntime);

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-01",
        ["ref_save_error"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STORAGE_ERROR");
        expect(result.error.message).toContain("Falha ao gerar revisao");
      }
    });

    it("should handle repository exception gracefully", async () => {
      reflectionRepository = {
        getById: jest.fn().mockImplementation(async () => {
          throw new Error("Database connection lost");
        }),
      };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        ["ref_exception"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("STORAGE_ERROR");
        expect(result.error.message).toContain("Falha ao gerar revisao");
        expect(result.error.message).toContain("Database connection lost");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle a single reflection with very short content", async () => {
      const shortReflection = new ReflectionEntry({
        id: "ref_short",
        entryDate: "2026-04-01",
        content: "Dia dificil.",
        moodTags: ["dificil"],
        triggerTags: [],
        sourceLocale: "pt-BR",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      });

      reflectionRepository = {
        getById: jest.fn().mockResolvedValue(ok(shortReflection)),
      };
      const mockRuntime = {
        initialize: jest
          .fn()
          .mockResolvedValue(err(createError("NOT_READY", "AI unavailable"))),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest.fn(),
        generateCompletion: jest.fn(),
        getCurrentModel: jest.fn().mockReturnValue(null),
      };
      jest
        .spyOn(
          require("../../../shared/ai/local-ai-runtime"),
          "getLocalAIRuntime",
        )
        .mockReturnValue(mockRuntime);

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-01",
        ["ref_short"],
      );

      expect(result.success).toBe(true);
    });

    it("should not create retry job when there are no reflections to retry", async () => {
      reflectionRepository = { getById: jest.fn().mockResolvedValue(ok(null)) };
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-30",
        [],
      );

      expect(result.success).toBe(false);
      expect(jobStore.createJob).not.toHaveBeenCalled();
    });
  });
});
