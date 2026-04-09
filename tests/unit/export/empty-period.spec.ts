/**
 * T056: Unit tests for empty period export handling
 *
 * Tests export with no reflections, reflections but no questions,
 * and user-friendly empty state messages in pt-BR.
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

describe("T056: Empty Period Export Handling", () => {
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

  describe("export with no reflections in date range", () => {
    it("should succeed with empty reflectionIds array", async () => {
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
        expect(result.data.id).toBeDefined();
        expect(result.data.fileSize).toBeGreaterThan(0);
      }
    });

    it("should generate minimal markdown when no content is included", async () => {
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
        const bundleResult = await exportService.getExport(result.data.id);
        expect(bundleResult.success).toBe(true);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          expect(md).toContain("# Reflexoes de 2026-04-01 ate 2026-04-30");
          expect(md).not.toContain("## Reflexoes");
          expect(md).not.toContain("## Conjuntos de Questoes");
          expect(md).not.toContain("## Analises Periodicas");
          expect(md).toContain("Exportado em:");
        }
      }
    });

    it("should produce valid markdown file even with no reflections", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName).toBe("reflexoes_2026-01-01_2026-12-31.md");
        expect(result.data.fileSize).toBeGreaterThan(0);
      }
    });

    it("should handle a future date range with no reflections", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2027-01-01",
        periodEnd: "2027-12-31",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          expect(bundleResult.data.markdownContent).toContain(
            "2027-01-01 ate 2027-12-31",
          );
        }
      }
    });

    it("should show empty period message in pt-BR when no content found", async () => {
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
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          expect(md).toContain("Nenhum conteudo encontrado para este periodo");
        }
      }
    });
  });

  describe("export with reflections but no guided questions", () => {
    it("should generate export with reflections only (no questions section)", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "Reflection 1",
          entryDate: "2026-04-02",
        }),
      );
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_002",
          content: "Reflection 2",
          entryDate: "2026-04-05",
        }),
      );
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_003",
          content: "Reflection 3",
          entryDate: "2026-04-07",
        }),
      );

      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-07",
        reflectionIds: ["ref_001", "ref_002", "ref_003"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          expect(md).toContain("## Reflexoes");
          expect(md).toContain("Total de reflexoes: 3");
          expect(md).not.toContain("## Conjuntos de Questoes");
        }
      }
    });

    it("should generate export with reflections and reviews but no questions", async () => {
      mockReflectionRepo.getById.mockResolvedValue(
        ok({
          id: "ref_001",
          content: "R1",
          entryDate: "2026-04-05",
        }),
      );
      mockReviewRepo.getById.mockResolvedValue(
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
        reflectionIds: ["ref_001", "ref_002"],
        questionSetIds: [],
        reviewIds: ["review_001"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          expect(md).toContain("## Reflexoes");
          expect(md).toContain("Total de reflexoes: 2");
          expect(md).not.toContain("## Conjuntos de Questoes");
          expect(md).toContain("## Analises Periodicas");
          expect(md).toContain("Total de analises: 1");
        }
      }
    });

    it("should correctly count sections when questions are omitted", async () => {
      mockReflectionRepo.getById.mockResolvedValueOnce(
        ok({
          id: "ref_001",
          content: "R1",
          entryDate: "2026-04-05",
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
      if (result.success)
        expect(result.data.sectionCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("user-friendly empty state messages in pt-BR", () => {
    it("should include Portuguese header text even for empty export", async () => {
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
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          expect(md).toContain("Reflexoes de");
          expect(md).toContain("ate");
          expect(md).toContain("Exportado em:");
        }
      }
    });

    it("should produce readable export for single-day empty period", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-15",
        periodEnd: "2026-04-15",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          expect(bundleResult.data.markdownContent).toContain(
            "2026-04-15 ate 2026-04-15",
          );
        }
      }
    });

    it("should include separator line in all exports including empty ones", async () => {
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
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          expect(bundleResult.data.markdownContent).toContain("---");
        }
      }
    });
  });

  describe("validation for empty/invalid periods", () => {
    it("should reject export with empty periodStart", async () => {
      const input: MarkdownExportInput = {
        periodStart: "",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain(
          "Period start and end are required",
        );
      }
    });

    it("should reject export with empty periodEnd", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain(
          "Period start and end are required",
        );
      }
    });

    it("should reject export with start date after end date", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-12-31",
        periodEnd: "2026-01-01",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain(
          "Start date cannot be after end date",
        );
      }
    });
  });

  describe("edge cases for empty exports", () => {
    it("should handle export with single empty reviewId", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: ["nonexistent_review"],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          // Review not found, so no review section but still valid markdown
          expect(md).toContain("Exportado em:");
        }
      }
    });

    it("should handle export with single empty questionSetId", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: [],
        questionSetIds: ["nonexistent_qs"],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const md = bundleResult.data.markdownContent;
          // No reflections found, so question sets section will show empty message
          expect(md).toContain("## Conjuntos de Questoes");
        }
      }
    });

    it("should handle very long date range with no content", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2020-01-01",
        periodEnd: "2026-12-31",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName).toContain("2020-01-01_2026-12-31");
        expect(result.data.fileSize).toBeGreaterThan(0);
      }
    });

    it("should generate unique IDs for multiple empty exports", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const r1 = await exportService.generateExport(input);
      const r2 = await exportService.generateExport(input);
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      if (r1.success && r2.success) {
        expect(r1.data.id).not.toBe(r2.data.id);
        expect(r1.data.fileName).toBe(r2.data.fileName);
      }
    });

    it("should handle export with whitespace-only period values", async () => {
      const input: MarkdownExportInput = {
        periodStart: "  ",
        periodEnd: "2026-04-30",
        reflectionIds: ["ref_001"],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(false);
    });
  });

  describe("empty state content structure", () => {
    it("should have proper markdown structure with title and footer", async () => {
      const input: MarkdownExportInput = {
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        reflectionIds: [],
        questionSetIds: [],
        reviewIds: [],
      };
      const result = await exportService.generateExport(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const bundleResult = await exportService.getExport(result.data.id);
        if (bundleResult.success) {
          const lines = bundleResult.data.markdownContent.split("\n");
          expect(lines[0]).toMatch(/^# Reflexoes de/);
          const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
          expect(nonEmptyLines[nonEmptyLines.length - 1]).toContain(
            "Exportado em:",
          );
        }
      }
    });

    it("should maintain consistent empty export format across periods", async () => {
      const periods = [
        { start: "2026-01-01", end: "2026-01-31" },
        { start: "2026-06-01", end: "2026-06-30" },
        { start: "2026-12-01", end: "2026-12-31" },
      ];
      for (const period of periods) {
        const input: MarkdownExportInput = {
          periodStart: period.start,
          periodEnd: period.end,
          reflectionIds: [],
          questionSetIds: [],
          reviewIds: [],
        };
        const result = await exportService.generateExport(input);
        expect(result.success).toBe(true);
        if (result.success) {
          const bundleResult = await exportService.getExport(result.data.id);
          if (bundleResult.success) {
            const md = bundleResult.data.markdownContent;
            expect(md).toMatch(/^# Reflexoes de/m);
            expect(md).toContain("Exportado em:");
          }
        }
      }
    });
  });
});
