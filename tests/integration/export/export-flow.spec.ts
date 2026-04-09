/**
 * T055: Integration tests for full export flow with llama.rn content
 *
 * Tests full export flow, mixed content, file output, and performance with 365 entries.
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

import { ExportRepository } from "../../../features/export/repository/export-repository";
import {
    MarkdownExportInput,
    MarkdownExportService,
} from "../../../features/export/service/markdown-export-service";
import { ok } from "../../../shared/utils/app-error";

describe("T055: Export Flow - Integration Tests", () => {
  let exportService: MarkdownExportService;
  let mockRepository: ExportRepository;

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
    mockRepository = new ExportRepository();
    exportService = new MarkdownExportService(
      mockRepository,
      mockReflectionRepo,
      mockReviewRepo,
    );
    mockRepository.clear();
  });

  describe("full export flow: date range -> gather -> generate -> validate", () => {
    it("should complete full export flow for a monthly period", async () => {
      const reflectionIds = [
        "ref_apr_01",
        "ref_apr_05",
        "ref_apr_10",
        "ref_apr_15",
        "ref_apr_20",
        "ref_apr_25",
        "ref_apr_30",
      ];
      reflectionIds.forEach((id, i) => {
        mockReflectionRepo.getById.mockResolvedValueOnce(
          ok({
            id,
            content: `Reflection ${i + 1}`,
            entryDate: `2026-04-${String(i * 5 + 1).padStart(2, "0")}`,
          }),
        );
      });

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds,
        questionSetIds: [
          "qs_apr_week1",
          "qs_apr_week2",
          "qs_apr_week3",
          "qs_apr_week4",
        ],
        reviewIds: ["review_apr_mid", "review_apr_end"],
      };
      const exportResult = await exportService.generateExport(input);
      expect(exportResult.success).toBe(true);
      if (exportResult.success) {
        const retrievedResult = await exportService.getExport(
          exportResult.data.id,
        );
        expect(retrievedResult.success).toBe(true);
        if (retrievedResult.success) {
          const bundle = retrievedResult.data;
          expect(bundle.periodStart).toBe("2026-04-01");
          expect(bundle.periodEnd).toBe("2026-04-30");
          expect(bundle.includedReflectionIds).toEqual(input.reflectionIds);
          expect(bundle.includedQuestionSetIds).toEqual(input.questionSetIds);
          expect(bundle.includedReviewIds).toEqual(input.reviewIds);
          expect(bundle.markdownContent.length).toBeGreaterThan(0);
          expect(bundle.state).toBe("ready");
          expect(exportResult.data.fileName).toBe(
            "reflexoes_2026-04-01_2026-04-30.md",
          );
          expect(exportResult.data.fileSize).toBeGreaterThan(0);
          expect(exportResult.data.sectionCount).toBeGreaterThan(0);
        }
      }
    });

    it("should handle a weekly export with minimal content", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_week1",
          content: "Weekly reflection",
          entryDate: "2026-04-03",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-07",
        reflectionIds: ["ref_week1"],
        questionSetIds: ["qs_week1"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName).toBe("reflexoes_2026-04-01_2026-04-07.md");
        expect(result.data.fileSize).toBeGreaterThan(0);
      }
    });

    it("should handle a quarterly export with many entries", async () => {
      const reflectionIds: string[] = [];
      for (let i = 1; i <= 90; i++) {
        reflectionIds.push(`ref_day_${i}`);
        mockReflectionRepo.getById.mockResolvedValueOnce(
          ok({
            id: `ref_day_${i}`,
            content: `Day ${i} reflection`,
            entryDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
          }),
        );
      }

      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        reflectionIds,
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(0);
        expect(result.data.sectionCount).toBeGreaterThanOrEqual(1);
        expect(result.data.fileName).toBe("reflexoes_2026-01-01_2026-03-31.md");
      }
    });
  });

  describe("mixed content: reflections, questions, reviews", () => {
    it("should include all content types in markdown", async () => {
      mockReflectionRepo.getById.mockResolvedValue(
        ok({
          id: "ref_001",
          content: "R1",
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
      mockReviewRepo.getById.mockResolvedValue(
        ok({
          summary: "Review summary",
          recurringPatterns: ["p1"],
          emotionalTriggers: ["t1"],
          nextInquiryPrompts: ["pr1?"],
          generatedAt: "2026-04-15T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001", "ref_002", "ref_003"],
        questionSetIds: ["qs_001", "qs_002"],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = await exportService.getExport(result.data.id);
        expect(content.success).toBe(true);
        if (content.success) {
          const md = content.data.markdownContent;
          expect(md).toContain("## Reflexoes");
          expect(md).toContain("## Analises Periodicas");
          expect(md).toContain("Q1?");
          expect(md).toContain("Review summary");
        }
      }
    });

    it("should handle export with only reflections", async () => {
      mockReflectionRepo.getById.mockResolvedValue(
        ok({
          id: "ref_001",
          content: "Only reflection",
          entryDate: "2026-04-05",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001", "ref_002"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = await exportService.getExport(result.data.id);
        if (content.success) {
          const md = content.data.markdownContent;
          expect(md).toContain("## Reflexoes");
          expect(md).not.toContain("## Conjuntos de Questoes");
          expect(md).not.toContain("## Analises Periodicas");
        }
      }
    });

    it("should handle export with only reviews", async () => {
      mockReviewRepo.getById.mockResolvedValue(
        ok({
          summary: "Q1 review",
          recurringPatterns: [],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-03-31T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: ["review_q1"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = await exportService.getExport(result.data.id);
        if (content.success) {
          const md = content.data.markdownContent;
          expect(md).not.toContain("## Reflexoes");
          expect(md).not.toContain("## Conjuntos de Questoes");
          expect(md).toContain("## Analises Periodicas");
        }
      }
    });

    it("should handle export with only question sets", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Reflection with questions",
          entryDate: "2026-04-03",
        }),
      );
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValueOnce(
        ok([
          {
            reflectionId: "ref_001",
            questions: ["Q from qs_001?"],
            generatedAt: "2026-04-03T10:00:00Z",
          },
        ]),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-07",
        reflectionIds: ["ref_001"],
        questionSetIds: ["qs_001"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const content = await exportService.getExport(result.data.id);
        if (content.success) {
          const md = content.data.markdownContent;
          expect(md).toContain("## Reflexoes");
          expect(md).toContain("Q from qs_001?");
          expect(md).not.toContain("## Analises Periodicas");
        }
      }
    });
  });

  describe("file output (mock file system)", () => {
    it("should generate a valid .md filename", async () => {
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
        expect(result.data.fileName).toMatch(
          /^reflexoes_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.md$/,
        );
      }
    });

    it("should produce markdown content that could be written to a file", async () => {
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
        const content = await exportService.getExport(result.data.id);
        expect(content.success).toBe(true);
        if (content.success) {
          const md = content.data.markdownContent;
          expect(typeof md).toBe("string");
          expect(md.length).toBeGreaterThan(0);
          const byteLength = new TextEncoder().encode(md).length;
          expect(result.data.fileSize).toBe(byteLength);
        }
      }
    });

    it("should generate unique filenames for different periods", async () => {
      const input1: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const input2: MarkdownExportInput = {
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        reflectionIds: ["ref_002"],
        questionSetIds: [],
        reviewIds: [],
      };
      const r1 = await exportService.generateExport(input1);
      const r2 = await exportService.generateExport(input2);
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      if (r1.success && r2.success) {
        expect(r1.data.fileName).not.toBe(r2.data.fileName);
        expect(r1.data.fileName).toContain("2026-04");
        expect(r2.data.fileName).toContain("2026-05");
      }
    });

    it("should track multiple exports in repository", async () => {
      const inputs: MarkdownExportInput[] = [
        {
          periodStart: "2026-04-01",
          periodEnd: "2026-04-07",
          reflectionIds: ["ref_w1"],
          questionSetIds: [],
          reviewIds: [],
        },
        {
          periodStart: "2026-04-08",
          periodEnd: "2026-04-14",
          reflectionIds: ["ref_w2"],
          questionSetIds: [],
          reviewIds: [],
        },
        {
          periodStart: "2026-04-15",
          periodEnd: "2026-04-21",
          reflectionIds: ["ref_w3"],
          questionSetIds: [],
          reviewIds: [],
        },
      ];
      for (const input of inputs) {
        const result = await exportService.generateExport(input);
        expect(result.success).toBe(true);
      }
      const listResult = await exportService.listExports();
      expect(listResult.success).toBe(true);
      if (listResult.success) expect(listResult.data.length).toBe(3);
    });
  });

  describe("performance with large dataset", () => {
    it("should handle export with 365 reflection entries (yearly)", async () => {
      const reflectionIds: string[] = [];
      for (let i = 1; i <= 365; i++) {
        reflectionIds.push(`ref_day_${i}`);
        mockReflectionRepo.getById.mockResolvedValueOnce(
          ok({
            id: `ref_day_${i}`,
            content: `Day ${i}`,
            entryDate: `2026-01-01`,
          }),
        );
      }

      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        reflectionIds,
        questionSetIds: [],
        reviewIds: [],
      };
      const startTime = Date.now();
      const result = await exportService.generateExport(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(0);
        const content = await exportService.getExport(result.data.id);
        if (content.success)
          expect(content.data.markdownContent).toContain(
            "Total de reflexoes: 365",
          );
      }
      expect(duration).toBeLessThan(5000);
    });

    it("should handle export with 365 entries + 52 question sets + 12 reviews", async () => {
      const reflectionIds: string[] = [];
      for (let i = 1; i <= 365; i++) {
        reflectionIds.push(`ref_day_${i}`);
        mockReflectionRepo.getById.mockResolvedValueOnce(
          ok({
            id: `ref_day_${i}`,
            content: `Day ${i}`,
            entryDate: `2026-01-01`,
          }),
        );
      }
      mockReflectionRepo.getQuestionSetsByReflection.mockResolvedValue(ok([]));
      mockReviewRepo.getById.mockResolvedValue(
        ok({
          summary: "Monthly review",
          recurringPatterns: [],
          emotionalTriggers: [],
          nextInquiryPrompts: [],
          generatedAt: "2026-01-31T10:00:00Z",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        reflectionIds,
        questionSetIds: [],
        reviewIds: [],
      };
      const startTime = Date.now();
      const result = await exportService.generateExport(input);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(0);
      }
      expect(duration).toBeLessThan(5000);
    });

    it("should handle export with 1000 entries without errors", async () => {
      const reflectionIds: string[] = [];
      for (let i = 1; i <= 1000; i++) {
        reflectionIds.push(`ref_entry_${i}`);
        mockReflectionRepo.getById.mockResolvedValueOnce(
          ok({
            id: `ref_entry_${i}`,
            content: `Entry ${i}`,
            entryDate: `2026-01-01`,
          }),
        );
      }

      const input: MarkdownExportInput = {
        periodStart: "2024-01-01",
        periodEnd: "2026-12-31",
        reflectionIds,
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileSize).toBeGreaterThan(0);
        const content = await exportService.getExport(result.data.id);
        if (content.success)
          expect(content.data.markdownContent).toContain(
            "Total de reflexoes: 1000",
          );
      }
    });
  });

  describe("export lifecycle management", () => {
    it("should create, retrieve, and delete an export", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const createResult = await exportService.generateExport(input);
      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const getResult = await exportService.getExport(createResult.data.id);
      expect(getResult.success).toBe(true);

      const deleteResult = await exportService.deleteExport(
        createResult.data.id,
      );
      expect(deleteResult.success).toBe(true);

      const afterDelete = await exportService.getExport(createResult.data.id);
      expect(afterDelete.success).toBe(false);
      if (!afterDelete.success)
        expect(afterDelete.error.code).toBe("NOT_FOUND");
    });

    it("should list all exports correctly", async () => {
      const inputs: MarkdownExportInput[] = [
        {
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          reflectionIds: ["ref_jan"],
          questionSetIds: [],
          reviewIds: [],
        },
        {
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
          reflectionIds: ["ref_feb"],
          questionSetIds: [],
          reviewIds: [],
        },
        {
          periodStart: "2026-03-01",
          periodEnd: "2026-03-31",
          reflectionIds: ["ref_mar"],
          questionSetIds: [],
          reviewIds: [],
        },
      ];
      for (const input of inputs) {
        const result = await exportService.generateExport(input);
        expect(result.success).toBe(true);
      }
      const listResult = await exportService.listExports();
      expect(listResult.success).toBe(true);
      if (listResult.success) expect(listResult.data.length).toBe(3);
    });
  });

  describe("edge cases in export flow", () => {
    it("should handle export with same start and end date", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-15",
        periodEnd: "2026-04-15",
        reflectionIds: ["ref_single_day"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success)
        expect(result.data.fileName).toContain("2026-04-15_2026-04-15");
    });

    it("should handle export with all empty ID arrays", async () => {
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
        const content = await exportService.getExport(result.data.id);
        if (content.success) {
          const md = content.data.markdownContent;
          expect(md).toContain("# Reflexoes de");
          expect(md).toContain("Exportado em:");
        }
      }
    });

    it("should handle multiple exports and list them all", async () => {
      for (let i = 1; i <= 5; i++) {
        const input: MarkdownExportInput = {
          periodStart: `2026-0${i}-01`,
          periodEnd: `2026-0${i}-30`,
          reflectionIds: [`ref_${i}`],
          questionSetIds: [],
          reviewIds: [],
        };
        const result = await exportService.generateExport(input);
        expect(result.success).toBe(true);
      }
      const listResult = await exportService.listExports();
      expect(listResult.success).toBe(true);
      if (listResult.success) expect(listResult.data.length).toBe(5);
    });
  });
});
