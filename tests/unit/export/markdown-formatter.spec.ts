/**
 * T054: Unit tests for markdown formatting with llama.rn-generated content
 *
 * Tests export of reflections with timestamps, guided questions inclusion,
 * period reviews inclusion, proper markdown structure, and pt-BR content.
 */

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

import { ExportBundle } from "../../../features/export/model/export-bundle";
import { ExportRepository } from "../../../features/export/repository/export-repository";
import {
    MarkdownExportInput,
    MarkdownExportService,
} from "../../../features/export/service/markdown-export-service";
import { ok } from "../../../shared/utils/app-error";

describe("T054: Markdown Formatter", () => {
  let exportService: MarkdownExportService;
  let mockRepository: ExportRepository;
  let savedBundles: ExportBundle[];

  // Mock reflection and review repositories
  const mockReflectionRepo = {
    getById: jest.fn().mockResolvedValue(ok(null)),
    getByDateRange: jest.fn().mockResolvedValue(ok([])),
    getAll: jest.fn().mockResolvedValue(ok([])),
    getQuestionSetsByReflection: jest.fn().mockResolvedValue(ok([])),
  };

  const mockReviewRepo = {
    getById: jest.fn().mockResolvedValue(ok(null)),
    getByPeriod: jest.fn().mockResolvedValue(ok([])),
    listAll: jest.fn().mockResolvedValue(ok([])),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    savedBundles = [];
    mockRepository = {
      getById: jest.fn().mockResolvedValue(ok(null)),
      getByPeriod: jest.fn().mockResolvedValue(ok([])),
      save: jest.fn().mockImplementation(async (bundle: ExportBundle) => {
        savedBundles.push(bundle);
        return ok(bundle);
      }),
      delete: jest.fn().mockResolvedValue(ok(undefined)),
      listAll: jest.fn().mockResolvedValue(ok([])),
      clear: jest.fn().mockResolvedValue(ok(undefined)),
    };

    // Mock the module imports
    jest.doMock(
      "../../../features/reflection/repository/reflection-repository",
      () => ({
        getReflectionRepository: () => mockReflectionRepo,
      }),
    );
    jest.doMock(
      "../../../features/review/repository/review-repository",
      () => ({
        getReviewRepository: () => mockReviewRepo,
      }),
    );

    exportService = new MarkdownExportService(
      mockRepository,
      mockReflectionRepo,
      mockReviewRepo,
    );
  });

  describe("markdown content generation", () => {
    it("should generate markdown with proper header structure", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001", "ref_002"],
        questionSetIds: ["qs_001"],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(savedBundles.length).toBe(1);
        expect(savedBundles[0].markdownContent).toContain(
          "# Reflexoes de 2026-04-01 ate 2026-04-30",
        );
      }
    });

    it("should include reflection section header when reflections are present", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test reflection 1",
          entryDate: "2026-04-05",
        }),
      );
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_002",
          content: "Test reflection 2",
          entryDate: "2026-04-10",
        }),
      );
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_003",
          content: "Test reflection 3",
          entryDate: "2026-04-15",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001", "ref_002", "ref_003"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("## Reflexoes");
        expect(content).toContain("Total de reflexoes: 3");
      }
    });

    it("should include question sets section when questions are present", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-05",
        }),
      );
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_001",
            questions: ["Q1?", "Q2?"],
            generatedAt: "2026-04-05T10:00:00Z",
          },
        ]),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001", "qs_002"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("Questoes guiadas");
        expect(content).toContain("Q1?");
        expect(content).toContain("Q2?");
      }
    });

    it("should include period reviews section when reviews are present", async () => {
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Test summary",
          recurringPatterns: ["pattern1"],
          emotionalTriggers: ["trigger1"],
          nextInquiryPrompts: ["prompt1?"],
          generatedAt: "2026-04-15T10:00:00Z",
        }),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Test summary 2",
          recurringPatterns: [],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-04-20T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: ["review_001", "review_002"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("## Analises Periodicas");
        expect(content).toContain("Total de analises: 2");
      }
    });

    it("should omit empty sections when no IDs are provided", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).not.toContain("## Reflexoes");
        expect(content).not.toContain("## Conjuntos de Questoes");
        expect(content).not.toContain("## Analises Periodicas");
      }
    });
  });

  describe("export of reflections with timestamps", () => {
    it("should generate markdown with reflection count and content", async () => {
      for (let i = 1; i <= 5; i++) {
        mockReflectionRepo.getById.mockResolvedValueOnce(
          ok({
            id: `ref_00${i}`,
            content: `Reflection ${i}`,
            entryDate: `2026-03-${String(i).padStart(2, "0")}`,
          }),
        );
      }

      const input: MarkdownExportInput = {
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
        reflectionIds: ["ref_001", "ref_002", "ref_003", "ref_004", "ref_005"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(savedBundles[0].markdownContent).toContain(
          "Total de reflexoes: 5",
        );
        expect(savedBundles[0].markdownContent).toContain("Reflection 1");
        expect(savedBundles[0].markdownContent).toContain("Reflection 5");
      }
    });

    it("should include export timestamp in pt-BR format", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(savedBundles[0].markdownContent).toContain("Exportado em:");
      }
    });
  });

  describe("guided questions inclusion", () => {
    it("should include guided questions under reflections", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test reflection",
          entryDate: "2026-04-05",
        }),
      );
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_001",
            questions: ["O que voce sentiu?", "Como isso se manifesta?"],
            generatedAt: "2026-04-05T10:00:00Z",
          },
        ]),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-15",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_morning", "qs_evening", "qs_weekly"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("O que voce sentiu?");
        expect(content).toContain("Como isso se manifesta?");
      }
    });

    it("should handle single question set", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-01",
        }),
      );
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_001",
            questions: ["Single question?"],
            generatedAt: "2026-04-01T10:00:00Z",
          },
        ]),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-07",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_single"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(savedBundles[0].markdownContent).toContain("Single question?");
      }
    });
  });

  describe("period reviews inclusion", () => {
    it("should include review content in markdown", async () => {
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Padroes de sombra identificados",
          recurringPatterns: ["pattern1", "pattern2"],
          emotionalTriggers: ["trigger1"],
          nextInquiryPrompts: ["prompt1?"],
          generatedAt: "2026-03-15T10:00:00Z",
        }),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Segunda analise",
          recurringPatterns: [],
          emotionalTriggers: ["trigger2", "trigger3"],
          nextInquiryPrompts: ["prompt2?", "prompt3?"],
          generatedAt: "2026-03-31T10:00:00Z",
        }),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Terceira analise",
          recurringPatterns: ["pattern3"],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-03-20T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: ["review_jan", "review_feb", "review_mar"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("Total de analises: 3");
        expect(content).toContain("Padroes de sombra identificados");
        expect(content).toContain("Padroes recorrentes");
        expect(content).toContain("Gatilhos emocionais");
        expect(content).toContain("Proximas investigacoes");
      }
    });
  });

  describe("proper markdown structure", () => {
    it("should use # for main title", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      await exportService.generateExport(input);
      expect(savedBundles[0].markdownContent).toMatch(/^# /m);
    });

    it("should use ## for section headers", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-01",
        }),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Review",
          recurringPatterns: [],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-04-15T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001"],
        reviewIds: ["review_001"],
      };
      await exportService.generateExport(input);
      expect(savedBundles[0].markdownContent).toMatch(/^## /m);
    });

    it("should include separator (---) before export timestamp", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      await exportService.generateExport(input);
      expect(savedBundles[0].markdownContent).toContain("---");
    });

    it("should have proper newlines between sections", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-01",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001"],
        reviewIds: [],
      };
      await exportService.generateExport(input);
      expect(savedBundles[0].markdownContent).toMatch(/\n\n/);
    });

    it("should produce valid markdown that can be counted by section headers", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-01",
        }),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Review",
          recurringPatterns: [],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-04-15T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001"],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(savedBundles[0].getSectionCount()).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("pt-BR content with llama.rn-generated text", () => {
    it("should preserve Portuguese text in markdown content", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("Reflexoes de");
        expect(content).toContain("ate");
      }
    });

    it("should generate correct filename with Portuguese naming", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName).toBe("reflexoes_2026-04-01_2026-04-30.md");
        expect(result.data.fileName).toMatch(/\.md$/);
      }
    });

    it("should include pt-BR localized export timestamp", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      await exportService.generateExport(input);
      expect(savedBundles[0].markdownContent).toContain("Exportado em:");
    });

    it("should include llama.rn-generated reflection content with pt-BR text", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content:
            "Hoje reflecti sobre meus padroes de sombra e como eles se manifestam nas relacoes.",
          entryDate: "2026-04-10",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("Hoje reflecti sobre meus padroes de sombra");
      }
    });

    it("should include llama.rn-generated guided questions in pt-BR", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-10",
        }),
      );
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_001",
            questions: [
              "O que esta sombra revela sobre seus padroes internos?",
              "Como voce pode acolher este aspecto de si mesmo?",
            ],
            generatedAt: "2026-04-10T10:00:00Z",
          },
        ]),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain(
          "O que esta sombra revela sobre seus padroes internos?",
        );
        expect(content).toContain(
          "Como voce pode acolher este aspecto de si mesmo?",
        );
      }
    });

    it("should include llama.rn-generated review synthesis in pt-BR", async () => {
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary:
            "No periodo, suas reflexoes mostram linhas iniciais de autoconhecimento.",
          recurringPatterns: ["padrao de autossabotagem", "projecao da sombra"],
          emotionalTriggers: ["medo do abandono", "necessidade de controle"],
          nextInquiryPrompts: ["Como investigar sua relacao com a sombra?"],
          generatedAt: "2026-04-15T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain(
          "suas reflexoes mostram linhas iniciais de autoconhecimento",
        );
        expect(content).toContain("padrao de autossabotagem");
        expect(content).toContain("medo do abandono");
      }
    });
  });

  describe("file size calculation", () => {
    it("should calculate correct file size for markdown content", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const expectedSize = new TextEncoder().encode(
          savedBundles[0].markdownContent,
        ).length;
        expect(result.data.fileSize).toBe(expectedSize);
      }
    });

    it("should have non-zero file size for any non-empty export", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.fileSize).toBeGreaterThan(0);
    });
  });

  describe("section count validation", () => {
    it("should count all markdown headers as sections", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Test",
          entryDate: "2026-04-01",
        }),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Review",
          recurringPatterns: [],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-04-15T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001"],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success)
        expect(result.data.sectionCount).toBeGreaterThanOrEqual(3);
    });

    it("should count fewer sections when sections are omitted", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success)
        expect(result.data.sectionCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("input validation", () => {
    it("should reject export without periodStart", async () => {
      const input: MarkdownExportInput = {
        periodStart: "",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject export without periodEnd", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject export with start date after end date", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-30",
        periodEnd: "2026-04-01",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("comprehensive markdown with all sections", () => {
    it("should generate complete markdown with reflections, questions, and reviews", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Reflection 1",
          entryDate: "2026-01-10",
        }),
      );
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_002",
          content: "Reflection 2",
          entryDate: "2026-02-15",
        }),
      );
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_003",
          content: "Reflection 3",
          entryDate: "2026-03-20",
        }),
      );
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValue(
        ok([
          {
            reflectionId: "ref_001",
            questions: ["Q1?"],
            generatedAt: "2026-01-10T10:00:00Z",
          },
          {
            reflectionId: "ref_002",
            questions: ["Q2?"],
            generatedAt: "2026-02-15T10:00:00Z",
          },
        ]),
      );
      mockReviewRepo.getById.mockResolvedValueOnce(
        ok({
          summary: "Quarterly review",
          recurringPatterns: ["pattern1"],
          emotionalTriggers: ["trigger1"],
          nextInquiryPrompts: ["prompt1?"],
          generatedAt: "2026-03-31T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        reflectionIds: ["ref_001", "ref_002", "ref_003"],
        questionSetIds: ["qs_001", "qs_002"],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = savedBundles[0].markdownContent;
        expect(content).toContain("# Reflexoes de 2026-01-01 ate 2026-03-31");
        expect(content).toContain("## Reflexoes");
        expect(content).toContain("Total de reflexoes: 3");
        expect(content).toContain("Q1?");
        expect(content).toContain("Q2?");
        expect(content).toContain("## Analises Periodicas");
        expect(content).toContain("Total de analises: 1");
        expect(content).toContain("---");
        expect(content).toContain("Exportado em:");
        expect(result.data.fileName).toBe("reflexoes_2026-01-01_2026-03-31.md");
        expect(result.data.fileSize).toBeGreaterThan(0);
        expect(result.data.sectionCount).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe("getExport and deleteExport operations", () => {
    let realRepo: ExportRepository;
    let realService: MarkdownExportService;

    beforeEach(() => {
      realRepo = new ExportRepository();
      realService = new MarkdownExportService(
        realRepo,
        mockReflectionRepo,
        mockReviewRepo,
      );
      realRepo.clear();
    });

    it("should retrieve export by ID", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const createResult = await realService.generateExport(input);
      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const getResult = await realService.getExport(createResult.data.id);
        expect(getResult.success).toBe(true);
        if (getResult.success) {
          expect(getResult.data.id).toBe(createResult.data.id);
          expect(getResult.data.periodStart).toBe("2026-04-01");
        }
      }
    });

    it("should delete export by ID", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const createResult = await realService.generateExport(input);
      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const deleteResult = await realService.deleteExport(
          createResult.data.id,
        );
        expect(deleteResult.success).toBe(true);
      }
    });

    it("should return NOT_FOUND for non-existent export", async () => {
      const result = await realService.getExport("nonexistent_export_id");
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("NOT_FOUND");
    });
  });
});
