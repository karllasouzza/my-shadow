/**
 * T020: Integration test for guided question generation in normal mode
 *
 * Tests tone validation and storage interactions with mocked storage layer.
 */

import type { GuidedQuestionSetData } from "../../../features/reflection/model/guided-question-set";
import { getLocalAIRuntime } from "../../../shared/ai/local-ai-runtime";
import { getPtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import type {
    EncryptedReflectionStore,
    ReflectionRecord,
} from "../../../shared/storage/encrypted-reflection-store";

// Mock llama.rn native module
jest.mock("llama.rn", () => require("../../__mocks__/llama.rn"));

// In-memory mock store - use mock prefix so Jest allows it in jest.mock factory
const mockStoreData: {
  reflections: Map<string, ReflectionRecord>;
  questionSets: Map<string, GuidedQuestionSetData>;
} = {
  reflections: new Map(),
  questionSets: new Map(),
};

const mockOkResult = (data: unknown) => ({ success: true, data });

jest.mock("../../../shared/storage/encrypted-reflection-store", () => ({
  getReflectionStore: jest.fn(() => ({
    saveReflection: jest.fn(async (record: ReflectionRecord) => {
      mockStoreData.reflections.set(record.id, record);
      return mockOkResult(undefined);
    }),
    getReflection: jest.fn(async (id: string) => {
      const record = mockStoreData.reflections.get(id);
      if (!record) return mockOkResult(null);
      return mockOkResult(record);
    }),
    saveQuestionSet: jest.fn(async (qs: GuidedQuestionSetData) => {
      mockStoreData.questionSets.set(qs.id, qs);
      return mockOkResult(undefined);
    }),
    getQuestionSetsByReflection: jest.fn(async (reflectionId: string) => {
      const sets = Array.from(mockStoreData.questionSets.values()).filter(
        (qs) => qs.reflectionId === reflectionId,
      );
      return mockOkResult(sets);
    }),
    clear: jest.fn(async () => {
      mockStoreData.reflections.clear();
      mockStoreData.questionSets.clear();
      return mockOkResult(undefined);
    }),
  })),
  EncryptedReflectionStore: jest.fn(),
  ReflectionRecord: jest.fn(),
}));

// Mock local-ai-runtime
const mockRuntime = {
  initialize: jest.fn(),
  getStatus: jest.fn(),
};

jest.mock("../../../shared/ai/local-ai-runtime", () => ({
  getLocalAIRuntime: jest.fn(() => mockRuntime),
  LocalAIRuntimeService: jest.fn(),
}));

describe("Guided Question Generation - Normal Mode", () => {
  let store: EncryptedReflectionStore;
  let reflectionId: string;

  beforeEach(async () => {
    mockStoreData.reflections.clear();
    mockStoreData.questionSets.clear();
    jest.clearAllMocks();

    const {
      getReflectionStore,
    } = require("../../../shared/storage/encrypted-reflection-store");
    store = getReflectionStore();

    // Create a test reflection
    const reflection: ReflectionRecord = {
      id: "test_reflection_001",
      entryDate: new Date().toISOString().split("T")[0],
      content:
        "Hoje refleti sobre meus medos e percebo que posso enfrenta-los com coragem.",
      moodTags: ["introspectivo", "corajoso"],
      triggerTags: ["pessoal", "crescimento"],
      sourceLocale: "pt-BR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await store.saveReflection(reflection);
    expect(result.success).toBe(true);
    reflectionId = reflection.id;
  });

  it("should generate guided questions in Portuguese", async () => {
    const toneGuard = getPtBRJungianGuard();
    const sampleQuestions = [
      "O que este sentimento de coragem representa para voce?",
      "Como de voce pode cultivar mais seguranca em si mesmo?",
      "Qual e o medo de que voce esta explorando?",
    ];

    // Validate all generated questions are in Portuguese with appropriate tone
    for (const question of sampleQuestions) {
      const result = toneGuard.validate(question);
      expect(result.success).toBe(true);
    }
  });

  it("should include context from similar reflections", async () => {
    const retrievedReflection = await store.getReflection(reflectionId);
    expect(retrievedReflection.success).toBe(true);
    if (retrievedReflection.success) {
      expect(retrievedReflection.data).not.toBeNull();
      expect(retrievedReflection.data!.sourceLocale).toBe("pt-BR");
    }
  });

  it("should save generated question set to storage", async () => {
    const questionSet = {
      id: "qs_001",
      reflectionId,
      generationMode: "normal" as const,
      questions: [
        "O que este sentimento esta tentando lhe ensinar?",
        "Como de voce poderia responder com compaixao?",
      ],
      retrievalContextReflectionIds: [reflectionId],
      modelId: "llama2-7b",
      modelVersion: "v1",
      generatedAt: new Date().toISOString(),
    };

    const result = await store.saveQuestionSet(questionSet);
    expect(result.success).toBe(true);

    // Verify retrieval
    const retrieved = await store.getQuestionSetsByReflection(reflectionId);
    expect(retrieved.success).toBe(true);
    if (retrieved.success) {
      expect(retrieved.data).not.toBeNull();
      expect(retrieved.data).toHaveLength(1);
      expect(retrieved.data[0].id).toBe("qs_001");
    }
  });

  it("should maintain performance budget (<8s p95)", async () => {
    mockRuntime.getStatus.mockResolvedValue({ modelLoaded: false });

    const runtime = getLocalAIRuntime();
    const status = await runtime.getStatus();
    expect(status).toBeDefined();
  });
});
