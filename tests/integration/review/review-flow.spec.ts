/**
 * T047: Integration tests for review generation flow with multiple reflections
 *
 * Tests the full flow: load reflections -> generate review -> validate
 * structured output. Covers 5+ mock reflections, recurring patterns,
 * trigger themes, and retry queue behavior.
 */

// llama.rn is auto-mocked via moduleNameMapper in jest.config.ts

// Mock react-native-mmkv
const mockMmkvInstance = {
  set: jest.fn(),
  getString: jest.fn(),
  remove: jest.fn(),
  getAllKeys: jest.fn((): string[] => []),
  clearAll: jest.fn(),
  isEncrypted: false,
  encrypt: jest.fn(),
};
jest.mock("react-native-mmkv", () => ({
  createMMKV: jest.fn(() => mockMmkvInstance),
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

// Mock the reflection store singleton
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

function generateMockReflections(): ReflectionEntry[] {
  return [
    new ReflectionEntry({
      id: "ref_week1_mon",
      entryDate: "2026-03-02",
      content:
        "Inicio da semana com sensacao de ansiedade. Percebi que tenho dificuldade em expressar minhas verdadeiras emocoes no trabalho. Ha uma sombra de inseguranca que se manifesta quando preciso falar em publico.",
      moodTags: ["ansioso", "inseguro"],
      triggerTags: ["trabalho", "falar-em-publico"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-02T08:00:00.000Z",
      updatedAt: "2026-03-02T08:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_week1_wed",
      entryDate: "2026-03-04",
      content:
        "Refleti sobre meus relacionamentos pessoais. Notei um padrao de evitar conflitos para manter a paz, mas isso pode estar me impedindo de crescer. A sombra do medo do confronto aparece frequentemente.",
      moodTags: ["reflexivo", "conflitante"],
      triggerTags: ["relacionamentos", "evitacao-de-conflito"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-04T20:00:00.000Z",
      updatedAt: "2026-03-04T20:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_week1_fri",
      entryDate: "2026-03-06",
      content:
        "Fim de semana chegando e sinto uma energia diferente. Percebo que meus momentos de maior clareza vem quando estou em silencio e introspeccao. A integracao da minha sombra comeca com auto-observacao.",
      moodTags: ["calmo", "introspectivo"],
      triggerTags: ["silencio", "auto-observacao"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-06T18:00:00.000Z",
      updatedAt: "2026-03-06T18:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_week2_mon",
      entryDate: "2026-03-09",
      content:
        "Nova semana com determinacao. Tentei abordar um assunto dificil com um colega e percebi que minha sombra de inseguranca ainda esta presente, mas consigo lidar melhor agora com consciencia.",
      moodTags: ["determinado", "consciente"],
      triggerTags: ["trabalho", "comunicacao-dificil"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-09T09:00:00.000Z",
      updatedAt: "2026-03-09T09:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_week2_wed",
      entryDate: "2026-03-11",
      content:
        "Hoje tive um insight importante: meus padroes de evitacao estao ligados a infancia. A sombra que carrego e de sempre querer agradar os outros. Reconhecer isso e o primeiro passo para a integracao.",
      moodTags: ["insight", "revelador"],
      triggerTags: ["padroes-de-infancia", "agradar-outros"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-11T21:00:00.000Z",
      updatedAt: "2026-03-11T21:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_week2_fri",
      entryDate: "2026-03-13",
      content:
        "Reflexao sobre progresso: ao longo dessas duas semanas, percebi evolucao na minha capacidade de auto-observacao. A sombra nao desaparece, mas aprendo a dialogar com ela de forma mais compassiva.",
      moodTags: ["progresso", "compassivo"],
      triggerTags: ["auto-evolucao", "dialogo-interno"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-13T19:00:00.000Z",
      updatedAt: "2026-03-13T19:00:00.000Z",
    }),
    new ReflectionEntry({
      id: "ref_week3_mon",
      entryDate: "2026-03-16",
      content:
        "Continuo notando que a ansiedade aparece em situacoes sociais, mas agora consigo identifica-la mais rapidamente. A pratica da introspeccao diaria esta me ajudando a reconhecer padroes emocionais antes que se intensifiquem.",
      moodTags: ["autoconsciente", "crescendo"],
      triggerTags: ["ansiedade-social", "introspeccao-diaria"],
      sourceLocale: "pt-BR",
      createdAt: "2026-03-16T07:30:00.000Z",
      updatedAt: "2026-03-16T07:30:00.000Z",
    }),
  ];
}

function buildComprehensiveReviewResponse(): string {
  return `RESUMO:
Durante o periodo de 2 de marco a 16 de marco de 2026, suas reflexoes revelam uma jornada profunda de autoconhecimento e integracao de sombras. Os padroes recorrentes indicam uma transicao significativa: de evitacao e inseguranca para auto-observacao consciente e dialogo compassion com aspectos internos rejeitados.

PADROES:
- Evitacao de conflitos como mecanismo de protecao emocional
- Inseguranca em situacoes de exposicao publica
- Introspeccao e silencio como fontes de clareza e autoconhecimento
- Progressao gradual de auto-observacao para auto-aceitacao
- Reconhecimento de padroes originados na infancia

GATILHOS:
- Ambientes de trabalho e necessidade de comunicacao assertiva
- Relacionamentos interpessoais e medo de confronto
- Situacoes sociais que ativam ansiedade e inseguranca
- Necessidade de agradar os outros como padrao automatico

PROMPTS:
- Como aprofundar o dialogo com suas sombras de forma ainda mais compassion?
- Quais outros padroes de infancia podem estar influenciando suas reacoes atuais?
- O que a ansiedade social esta tentando proteger em voce?
- Como transformar a necessidade de agradar em autenticidade gradual?`;
}

function buildPatternFocusedResponse(): string {
  return `RESUMO:
A analise das reflexoes revela padroes recorrentes bem definidos. A ansiedade social e a inseguranca nao desaparecem, mas aparecem consistentemente ao longo do periodo para quem busca com cuidado o autoconhecimento.

PADROES:
- Ansiedade social recorrente em contextos profissionais
- Inseguranca como sombra predominante
- Introspeccao como ferramenta de crescimento
- Evolucao da auto-observacao ao longo do tempo

GATILHOS:
- Apresentacoes no trabalho
- Conversas dificeis com colegas
- Ambientes sociais desconhecidos

PROMPTS:
- De que forma a introspeccao pode se tornar ainda mais eficaz?
- O que a recorrencia da ansiedade revela sobre necessidades nao atendidas?`;
}

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

describe("T047: Review Generation Flow - Integration Tests", () => {
  let mockReflections: ReflectionEntry[];
  let reflectionRepository: any;
  let reviewRepository: any;
  let jobStore: any;
  let savedReviews: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    savedReviews = [];
    mockReflections = generateMockReflections();

    const mockStore: Record<string, string> = {};
    mockMmkvInstance.set.mockImplementation((key: string, value: string) => {
      mockStore[key] = value;
    });
    mockMmkvInstance.getString.mockImplementation(
      (key: string) => mockStore[key],
    );
    mockMmkvInstance.getAllKeys.mockImplementation((): string[] =>
      Object.keys(mockStore),
    );

    reflectionRepository = {
      getById: jest.fn().mockImplementation(async (id: string) => {
        const r = mockReflections.find((r) => r.id === id);
        return r ? ok(r) : ok(null);
      }),
      getAll: jest.fn().mockResolvedValue(ok(mockReflections)),
      getByDateRange: jest.fn().mockResolvedValue(ok(mockReflections)),
    };

    reviewRepository = {
      save: jest.fn().mockImplementation(async (record: any) => {
        savedReviews.push(record);
        return ok(undefined);
      }),
    };

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

  describe("full flow: load reflections -> generate review -> validate", () => {
    it("should process 7 reflections and generate a comprehensive review", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            text: buildComprehensiveReviewResponse(),
            promptTokens: 200,
            completionTokens: 300,
            totalTokens: 500,
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.summary.length).toBeGreaterThan(50);
        expect(result.data.patterns.length).toBeGreaterThanOrEqual(3);
        expect(result.data.triggers.length).toBeGreaterThanOrEqual(2);
        expect(result.data.prompts.length).toBeGreaterThanOrEqual(2);
        expect(savedReviews.length).toBe(1);
        expect(savedReviews[0].reflectionIds).toEqual(allIds);
        expect(savedReviews[0].periodStart).toBe("2026-03-02");
        expect(savedReviews[0].periodEnd).toBe("2026-03-16");
      }
    });

    it("should correctly load each reflection's content for review generation", async () => {
      const reflectionIds = ["ref_week1_mon", "ref_week1_wed", "ref_week2_mon"];
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
          .mockImplementation(async (messages: any[]) => {
            const userMessage = messages.find((m: any) => m.role === "user");
            expect(userMessage.content).toContain("ansiedade");
            expect(userMessage.content).toContain("relacionamentos");
            expect(userMessage.content).toContain("determinacao");
            return ok({
              text: buildComprehensiveReviewResponse(),
              promptTokens: 150,
              completionTokens: 250,
              totalTokens: 400,
            });
          }),
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
        "2026-03-02",
        "2026-03-09",
        reflectionIds,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("recurring patterns and trigger themes identification", () => {
    it("should identify recurring patterns from multiple reflections", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            text: buildPatternFocusedResponse(),
            promptTokens: 200,
            completionTokens: 200,
            totalTokens: 400,
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const hasMatchingPattern = result.data.patterns.some((p) =>
          /ansiedade|inseguranca|introspeccao/i.test(p),
        );
        expect(hasMatchingPattern).toBe(true);
        expect(result.data.triggers.length).toBeGreaterThan(0);
        expect(result.data.triggers[0].length).toBeGreaterThan(5);
      }
    });

    it("should generate inquiry prompts based on reflection themes", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            text: buildComprehensiveReviewResponse(),
            promptTokens: 200,
            completionTokens: 300,
            totalTokens: 500,
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompts.length).toBeGreaterThanOrEqual(2);
        result.data.prompts.forEach((p) => {
          expect(p.length).toBeGreaterThan(10);
          expect(p.endsWith("?")).toBe(true);
        });
      }
    });
  });

  describe("date range spanning", () => {
    it("should handle reflections spanning 2 weeks", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
          .mockImplementation(async (messages: any[]) => {
            const userMessage = messages.find((m: any) => m.role === "user");
            expect(userMessage.content).toContain("2026-03-02");
            expect(userMessage.content).toContain("2026-03-16");
            return ok({
              text: buildComprehensiveReviewResponse(),
              promptTokens: 200,
              completionTokens: 300,
              totalTokens: 500,
            });
          }),
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(savedReviews[0].periodStart).toBe("2026-03-02");
        expect(savedReviews[0].periodEnd).toBe("2026-03-16");
      }
    });

    it("should handle a subset of reflections within a date range", async () => {
      const subsetIds = ["ref_week1_mon", "ref_week1_wed", "ref_week1_fri"];
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
          .mockImplementation(async (messages: any[]) => {
            const userMessage = messages.find((m: any) => m.role === "user");
            expect(userMessage.content).toContain("Inicio da semana");
            expect(userMessage.content).toContain("relacionamentos pessoais");
            return ok({
              text: buildPatternFocusedResponse(),
              promptTokens: 100,
              completionTokens: 150,
              totalTokens: 250,
            });
          }),
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
        "2026-03-02",
        "2026-03-06",
        subsetIds,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("retry queue behavior on failure", () => {
    it("should create retry job when AI generation fails", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
              createError(
                "LOCAL_GENERATION_UNAVAILABLE",
                "Model loading failed",
              ),
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      expect(jobStore.createJob).toHaveBeenCalledWith(
        "final_review",
        expect.any(String),
        3,
      );
    });

    it("should create retry job when AI output is empty", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            promptTokens: 100,
            completionTokens: 0,
            totalTokens: 100,
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      expect(jobStore.createJob).toHaveBeenCalled();
    });

    it("should NOT create retry job when AI succeeds", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            text: buildComprehensiveReviewResponse(),
            promptTokens: 200,
            completionTokens: 300,
            totalTokens: 500,
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
      await service.generateFinalReview("2026-03-02", "2026-03-16", allIds);

      expect(jobStore.createJob).not.toHaveBeenCalled();
    });

    it("should create retry job with maxAttempts=3", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            err(createError("LOCAL_GENERATION_UNAVAILABLE", "Timeout")),
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
      await service.generateFinalReview("2026-03-02", "2026-03-16", allIds);

      expect(jobStore.createJob).toHaveBeenCalledWith(
        "final_review",
        expect.any(String),
        3,
      );
    });
  });

  describe("structured output validation", () => {
    it("should produce valid output with all required fields", async () => {
      const allIds = mockReflections.map((r) => r.id);
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
            text: buildComprehensiveReviewResponse(),
            promptTokens: 200,
            completionTokens: 300,
            totalTokens: 500,
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
        "2026-03-02",
        "2026-03-16",
        allIds,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data;
        expect(typeof data.id).toBe("string");
        expect(data.summary.length).toBeGreaterThan(30);
        expect(data.patterns.length).toBeGreaterThanOrEqual(1);
        data.patterns.forEach((p) => {
          expect(typeof p).toBe("string");
          expect(p.length).toBeGreaterThan(2);
        });
        expect(Array.isArray(data.triggers)).toBe(true);
        expect(data.prompts.length).toBeGreaterThanOrEqual(1);
        data.prompts.forEach((p) => {
          expect(p.endsWith("?")).toBe(true);
        });
      }
    });
  });
});
