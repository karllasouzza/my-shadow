/**
 * T046: Unit tests for review generation with llama.rn mock
 *
 * Tests generateFinalReview() with mocked dependencies,
 * multiple reflections, output structure, pt-BR language
 * requirements, and error handling.
 */

// llama.rn is auto-mocked via moduleNameMapper in jest.config.ts

// Mock react-native-mmkv
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

// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  getRandomBytes: jest.fn((length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = i;
    return bytes;
  }),
}));

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock Platform
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Mock the reflection store singleton BEFORE any module that imports it
jest.mock("../../../shared/storage/encrypted-reflection-store", () => {
  return {
    initReflectionStore: jest.fn(),
    getReflectionStore: jest.fn(() => ({
      saveReflection: jest
        .fn()
        .mockResolvedValue({ success: true, data: undefined }),
      getReflection: jest.fn().mockResolvedValue({ success: true, data: null }),
      getAllReflections: jest
        .fn()
        .mockResolvedValue({ success: true, data: [] }),
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
    })),
    EncryptedReflectionStore: jest.fn(),
  };
});

import { ReflectionEntry } from "../../../features/reflection/model/reflection-entry";
import { ReviewService } from "../../../features/review/service/review-service";
import { FallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import { PtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import { createError, err, ok } from "../../../shared/utils/app-error";

// Build AI review response that passes parsing
function buildAIReviewResponse(): string {
  return `RESUMO:
Durante o periodo analisado, suas reflexoes revelam uma jornada de autoconhecimento marcante. Os padroes emocionais indicam uma busca constante por integracao entre aspectos conscientes e inconscientes.

PADROES:
- Reflexoes recorrentes sobre autoconhecimento e sombras internas
- Padrao de introspecao em momentos de transicao
- Busca por significado em relacoes interpessoais

GATILHOS:
- Conflitos em relacoes pessoais despertam reflexao profunda
- Momentos de silencio revelam emocoes subjacentes
- Desafios profissionais ativam padroes de auto-duvida

PROMPTS:
- O que voce sente quando observa suas sombras internas?
- Como suas emocoes se manifestam em momentos de silencio?
- Qual padrao recorrente voce nota em suas interacoes?`;
}

function buildMinimalAIResponse(): string {
  return `RESUMO:
Periodo com reflexoes basicas sobre o dia a dia sem padroes significativos.

PADROES:
- Padrao simples

GATILHOS:
- Gatilho basico

PROMPTS:
- O que voce acha disso?`;
}

// Create a ReviewService and inject mocked dependencies
function createReviewService(deps: {
  reflectionRepository: any;
  reviewRepository: any;
  jobStore: any;
}) {
  const service = new ReviewService();
  // Override the readonly properties via reflection
  (service as any).reflectionRepository = deps.reflectionRepository;
  (service as any).reviewRepository = deps.reviewRepository;
  (service as any).fallbackProvider = new FallbackPromptProvider();
  (service as any).toneGuard = new PtBRJungianGuard();
  (service as any).jobStore = deps.jobStore;
  return service;
}

describe("T046: Period Review Generation", () => {
  const mockReflections: ReflectionEntry[] = [
    new ReflectionEntry({
      id: "ref_001",
      entryDate: "2026-04-01",
      content:
        "Hoje refleti sobre meus medos internos e como eles influenciam minhas decisoes. Sinto que ha uma sombra que preciso integrar.",
      moodTags: ["introspectivo", "reflexivo"],
      triggerTags: ["medo", "inseguranca"],
      sourceLocale: "pt-BR",
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_002",
      entryDate: "2026-04-03",
      content:
        "Percebi um padrao recorrente em minhas interacoes sociais. Sempre que me sinto vulneravel, tento me afastar para me proteger.",
      moodTags: ["vulneravel", "protetor"],
      triggerTags: ["vulnerabilidade", "isolamento"],
      sourceLocale: "pt-BR",
      createdAt: "2026-04-03T14:00:00.000Z",
      updatedAt: "2026-04-03T14:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_003",
      entryDate: "2026-04-05",
      content:
        "A conexao entre minhas emocoes e minhas acoes ficou mais clara hoje. Entendi que minha sombra se manifesta quando evito confrontos.",
      moodTags: ["consciente", "integracao"],
      triggerTags: ["evitacao", "confronto"],
      sourceLocale: "pt-BR",
      createdAt: "2026-04-05T09:00:00.000Z",
      updatedAt: "2026-04-05T09:00:00.000Z",
    }),
  ];

  let reflectionRepository: any;
  let reviewRepository: any;
  let jobStore: any;

  beforeEach(() => {
    jest.clearAllMocks();

    reflectionRepository = {
      getById: jest.fn().mockImplementation(async (id: string) => {
        const reflection = mockReflections.find((r) => r.id === id);
        return reflection ? ok(reflection) : ok(null);
      }),
    };

    reviewRepository = {
      save: jest.fn().mockResolvedValue(ok(undefined)),
    };

    jobStore = {
      createJob: jest.fn().mockResolvedValue(
        ok({
          id: "job_mock",
          targetType: "final_review" as const,
          targetRefId: "review_mock",
          status: "queued" as const,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    };
  });

  describe("generateFinalReview() with multiple reflections", () => {
    it("should generate a review successfully with 3 reflections", async () => {
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
            text: buildAIReviewResponse(),
            promptTokens: 50,
            completionTokens: 100,
            totalTokens: 150,
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
        "2026-04-05",
        ["ref_001", "ref_002", "ref_003"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty("id");
        expect(result.data).toHaveProperty("summary");
        expect(result.data).toHaveProperty("patterns");
        expect(result.data).toHaveProperty("triggers");
        expect(result.data).toHaveProperty("prompts");
        expect(result.data.patterns.length).toBeGreaterThan(0);
        expect(result.data.triggers.length).toBeGreaterThan(0);
        expect(result.data.prompts.length).toBeGreaterThan(0);
      }
    });

    it("should include all expected output structure fields", async () => {
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
            text: buildAIReviewResponse(),
            promptTokens: 50,
            completionTokens: 100,
            totalTokens: 150,
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
        "2026-04-05",
        ["ref_001", "ref_002", "ref_003"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.summary).toBe("string");
        expect(result.data.summary.length).toBeGreaterThan(0);
        expect(Array.isArray(result.data.patterns)).toBe(true);
        expect(result.data.patterns.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(result.data.triggers)).toBe(true);
        expect(Array.isArray(result.data.prompts)).toBe(true);
        expect(result.data.prompts.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("pt-BR language requirements", () => {
    it("should generate review with pt-BR content in summary", async () => {
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
            text: buildAIReviewResponse(),
            promptTokens: 50,
            completionTokens: 100,
            totalTokens: 150,
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
        "2026-04-05",
        ["ref_001", "ref_002"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const ptBrCharRegex = /[a-z\u00E0-\u00FC]/;
        expect(ptBrCharRegex.test(result.data.summary)).toBe(true);
      }
    });

    it("should fall back to pt-BR template when AI output fails tone validation", async () => {
      // AI response with harsh language that fails tone validation
      const harshAIResponse = `RESUMO:
Este periodo foi um fracasso total. Voce e fraco e nao consegue fazer nada certo. Lixo de reflexoes.

PADROES:
- Padrao negativo

GATILHOS:
- Gatilho basico

PROMPTS:
- O que voce acha disso?`;

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
            text: harshAIResponse,
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
        "2026-04-05",
        ["ref_001"],
      );

      // Should still succeed using fallback template
      expect(result.success).toBe(true);
      if (result.success) {
        // Fallback should include period dates
        expect(result.data.summary).toContain("2026-04-01");
        expect(result.data.summary).toContain("2026-04-05");
      }
    });
  });

  describe("error handling", () => {
    it("should return error when reflectionIds array is empty", async () => {
      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-05",
        [],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain(
          "Nenhuma reflexao encontrada no periodo selecionado para gerar revisao.",
        );
      }
    });

    it("should return error when all reflections have empty content", async () => {
      reflectionRepository.getById = jest.fn().mockResolvedValue(
        ok(
          new ReflectionEntry({
            id: "ref_empty_001",
            entryDate: "2026-04-01",
            content: "",
            sourceLocale: "pt-BR",
            createdAt: "2026-04-01T10:00:00.000Z",
            updatedAt: "2026-04-01T10:00:00.000Z",
          }),
        ),
      );

      const service = createReviewService({
        reflectionRepository,
        reviewRepository,
        jobStore,
      });
      const result = await service.generateFinalReview(
        "2026-04-01",
        "2026-04-05",
        ["ref_empty_001"],
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain(
          "Nenhum conteudo de reflexao disponivel",
        );
      }
    });

    it("should use fallback when AI runtime initialization fails", async () => {
      const mockRuntime = {
        initialize: jest
          .fn()
          .mockResolvedValue(
            err(createError("NOT_READY", "Runtime unavailable")),
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
        "2026-04-01",
        "2026-04-05",
        ["ref_001", "ref_002"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toContain("2026-04-01");
        expect(result.data.summary).toContain("2026-04-05");
      }
    });

    it("should use fallback when AI completion fails", async () => {
      const mockRuntime = {
        initialize: jest.fn().mockResolvedValue(ok(undefined)),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest
          .fn()
          .mockResolvedValue(
            ok({ id: "qwen2.5-0.5b-quantized", isLoaded: true }),
          ),
        generateCompletion: jest
          .fn()
          .mockResolvedValue(
            err(
              createError("LOCAL_GENERATION_UNAVAILABLE", "Completion failed"),
            ),
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
        "2026-04-05",
        ["ref_001", "ref_002"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary.length).toBeGreaterThan(0);
        expect(result.data.patterns.length).toBeGreaterThan(0);
      }
    });

    it("should use fallback when AI returns empty completion", async () => {
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
            text: "",
            promptTokens: 10,
            completionTokens: 0,
            totalTokens: 10,
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
        "2026-04-05",
        ["ref_001"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toContain("2026-04-01");
      }
    });

    it("should create retry job when fallback is used", async () => {
      const mockRuntime = {
        initialize: jest.fn().mockResolvedValue(ok(undefined)),
        waitReady: jest.fn().mockResolvedValue(undefined),
        loadModel: jest
          .fn()
          .mockResolvedValue(
            ok({ id: "qwen2.5-0.5b-quantized", isLoaded: true }),
          ),
        generateCompletion: jest
          .fn()
          .mockResolvedValue(
            err(createError("LOCAL_GENERATION_UNAVAILABLE", "AI unavailable")),
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
      await service.generateFinalReview("2026-04-01", "2026-04-05", [
        "ref_001",
        "ref_002",
      ]);

      expect(jobStore.createJob).toHaveBeenCalledWith(
        "final_review",
        expect.any(String),
        3,
      );
    });
  });

  describe("output structure validation", () => {
    it("should parse RESUMO, PADROES, GATILHOS, PROMPTS sections correctly", async () => {
      const aiResponse = `RESUMO:
Sintese do periodo mostrando crescimento pessoal e autoconhecimento. Durante este tempo, voce nao deixou de buscar para si mesmo a compaixao e o cuidado que sao essenciais. Voce demonstrou que e possivel entender suas emocoes com muita gentileza.

PADROES:
- Introspecao matinal como rotina
- Reflexao sobre relacoes interpessoais

GATILHOS:
- Ansiedade antes de compromissos
- Sensacao de inadequacao em grupos

PROMPTS:
- Como integrar suas sombras de forma saudavel?
- O que suas emocoes revelam sobre seus valores?`;

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
            text: aiResponse,
            promptTokens: 50,
            completionTokens: 80,
            totalTokens: 130,
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
        "2026-04-05",
        ["ref_001", "ref_002"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toContain("Sintese do periodo");
        expect(result.data.patterns).toContain(
          "Introspecao matinal como rotina",
        );
        expect(result.data.patterns).toContain(
          "Reflexao sobre relacoes interpessoais",
        );
        expect(result.data.triggers).toContain(
          "Ansiedade antes de compromissos",
        );
        expect(result.data.triggers).toContain(
          "Sensacao de inadequacao em grupos",
        );
        expect(result.data.prompts.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("should ensure prompts end with question marks", async () => {
      const aiResponse = `RESUMO:
Periodo de reflexao profunda sobre temas internos.

PADROES:
- Padrao recorrente de introspecao

GATILHOS:
- Gatilho emocional em situacoes sociais

PROMPTS:
- O que voce sente ao olhar para dentro
- Como suas emocoes se manifestam?`;

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
            text: aiResponse,
            promptTokens: 50,
            completionTokens: 60,
            totalTokens: 110,
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
        "2026-04-05",
        ["ref_001"],
      );

      expect(result.success).toBe(true);
      if (result.success) {
        result.data.prompts.forEach((prompt) => {
          expect(prompt.endsWith("?")).toBe(true);
        });
      }
    });
  });
});
