/**
 * T049: Markdown Export Service
 * T057: Orchestrates markdown generation with llama.rn-generated content
 * T060: Includes performance timing and budget checking
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { getPerformanceMetrics } from "../../../shared/utils/performance-metrics";
import { ExportBundle } from "../model/export-bundle";
import {
    ExportRepository,
    getExportRepository,
} from "../repository/export-repository";

/** T060: Performance budget thresholds for export */
const PERF_BUDGET = {
  gatherDataMs: 500,
  generateMarkdownMs: 2000,
  totalMs: 10000,
};

export interface MarkdownExportInput {
  periodStart: string;
  periodEnd: string;
  reflectionIds: string[];
  questionSetIds: string[];
  reviewIds: string[];
}

export interface ExportResult {
  id: string;
  fileName: string;
  fileSize: number;
  sectionCount: number;
}

interface ExportTimings {
  gatherDataMs: number;
  generateMarkdownMs: number;
  totalMs: number;
  withinBudget: boolean;
  violations: string[];
}

export class MarkdownExportService {
  private repository: ExportRepository;
  private reflectionRepository: any;
  private reviewRepository: any;
  private metrics = getPerformanceMetrics();

  constructor(
    repository?: ExportRepository,
    reflectionRepo?: any,
    reviewRepo?: any,
  ) {
    this.repository = repository || getExportRepository();
    // Lazy init only when not provided (production)
    if (reflectionRepo) {
      this.reflectionRepository = reflectionRepo;
    }
    if (reviewRepo) {
      this.reviewRepository = reviewRepo;
    }
  }

  /**
   * Get reflection repo, lazy-initing if needed
   */
  private getReflectionRepo(): any {
    if (!this.reflectionRepository) {
      const mod = require("../../reflection/repository/reflection-repository");
      this.reflectionRepository = mod.getReflectionRepository();
    }
    return this.reflectionRepository;
  }

  /**
   * Get review repo, lazy-initing if needed
   */
  private getReviewRepo(): any {
    if (!this.reviewRepository) {
      const mod = require("../../review/repository/review-repository");
      this.reviewRepository = mod.getReviewRepository();
    }
    return this.reviewRepository;
  }

  /**
   * T057: Gather actual content from stores for export.
   * Fetches reflections, guided questions, and reviews by IDs.
   */
  private async gatherExportData(input: MarkdownExportInput): Promise<{
    reflections: { id: string; content: string; entryDate: string }[];
    questionSets: {
      reflectionId: string;
      questions: string[];
      generatedAt: string;
    }[];
    reviews: {
      summary: string;
      patterns: string[];
      triggers: string[];
      prompts: string[];
      generatedAt: string;
    }[];
  }> {
    const reflections: { id: string; content: string; entryDate: string }[] =
      [];
    const questionSets: {
      reflectionId: string;
      questions: string[];
      generatedAt: string;
    }[] = [];
    const reviews: {
      summary: string;
      patterns: string[];
      triggers: string[];
      prompts: string[];
      generatedAt: string;
    }[] = [];

    // Fetch reflection content
    for (const refId of input.reflectionIds) {
      const result = await this.getReflectionRepo().getById(refId);
      if (result.success && result.data) {
        reflections.push({
          id: result.data.id,
          content: result.data.content,
          entryDate: result.data.entryDate,
        });

        // Fetch guided questions for this reflection
        if (input.questionSetIds.length > 0) {
          const qsResult =
            await this.getReflectionRepo().getQuestionSetsByReflection(refId);
          if (qsResult.success) {
            for (const qs of qsResult.data) {
              questionSets.push({
                reflectionId: qs.reflectionId,
                questions: qs.questions,
                generatedAt: qs.generatedAt,
              });
            }
          }
        }
      }
    }

    // Fetch review content
    for (const reviewId of input.reviewIds) {
      const result = await this.getReviewRepo().getById(reviewId);
      if (result.success && result.data) {
        reviews.push({
          summary: result.data.summary,
          patterns: result.data.recurringPatterns,
          triggers: result.data.emotionalTriggers,
          prompts: result.data.nextInquiryPrompts,
          generatedAt: result.data.generatedAt,
        });
      }
    }

    return { reflections, questionSets, reviews };
  }

  /**
   * T057: Generate markdown content with actual llama.rn-generated content
   */
  private generateMarkdownContent(
    input: MarkdownExportInput,
    data: {
      reflections: { id: string; content: string; entryDate: string }[];
      questionSets: {
        reflectionId: string;
        questions: string[];
        generatedAt: string;
      }[];
      reviews: {
        summary: string;
        patterns: string[];
        triggers: string[];
        prompts: string[];
        generatedAt: string;
      }[];
    },
  ): string {
    const dateRange = `${input.periodStart} ate ${input.periodEnd}`;
    let content = `# Reflexoes de ${dateRange}\n\n`;

    // Reflections section with actual content
    if (data.reflections.length > 0) {
      content += `## Reflexoes\n\n`;
      content += `Total de reflexoes: ${data.reflections.length}\n\n`;

      for (const ref of data.reflections) {
        const formattedDate = new Date(ref.entryDate).toLocaleDateString(
          "pt-BR",
          {
            day: "2-digit",
            month: "long",
            year: "numeric",
          },
        );
        content += `### ${formattedDate}\n\n`;
        content += `${ref.content}\n\n`;

        // Include guided questions for this reflection
        const relatedQuestions = data.questionSets.filter(
          (qs) => qs.reflectionId === ref.id,
        );
        if (relatedQuestions.length > 0) {
          content += `**Questoes guiadas:**\n\n`;
          for (const qs of relatedQuestions) {
            for (const q of qs.questions) {
              content += `- ${q}\n`;
            }
          }
          content += `\n`;
        }

        content += `---\n\n`;
      }
    } else if (input.reflectionIds.length > 0) {
      content += `## Reflexoes\n\n`;
      content += `_Nenhuma reflexao encontrada para os IDs selecionados._\n\n`;
      content += `---\n\n`;
    }

    // Standalone question sets section (not already included under reflections)
    const standaloneQuestions = data.questionSets.filter(
      (qs) => !data.reflections.some((r) => r.id === qs.reflectionId),
    );
    if (standaloneQuestions.length > 0 || input.questionSetIds.length > 0) {
      content += `## Conjuntos de Questoes\n\n`;
      if (standaloneQuestions.length > 0) {
        content += `Total de conjuntos: ${standaloneQuestions.length}\n\n`;
        for (const qs of standaloneQuestions) {
          content += `**Reflexao:** ${qs.reflectionId}\n\n`;
          for (const q of qs.questions) {
            content += `- ${q}\n`;
          }
          content += `\n`;
        }
      } else {
        content += `_Nenhuma questao adicional._\n\n`;
      }
      content += `---\n\n`;
    }

    // Reviews section with actual content
    if (data.reviews.length > 0) {
      content += `## Analises Periodicas\n\n`;
      content += `Total de analises: ${data.reviews.length}\n\n`;

      for (const review of data.reviews) {
        const genDate = new Date(review.generatedAt).toLocaleString("pt-BR");
        content += `### Analise gerada em ${genDate}\n\n`;
        content += `${review.summary}\n\n`;

        if (review.patterns.length > 0) {
          content += `**Padroes recorrentes:**\n\n`;
          for (const p of review.patterns) {
            content += `- ${p}\n`;
          }
          content += `\n`;
        }

        if (review.triggers.length > 0) {
          content += `**Gatilhos emocionais:**\n\n`;
          for (const t of review.triggers) {
            content += `- ${t}\n`;
          }
          content += `\n`;
        }

        if (review.prompts.length > 0) {
          content += `**Proximas investigacoes:**\n\n`;
          for (const p of review.prompts) {
            content += `- ${p}\n`;
          }
          content += `\n`;
        }

        content += `---\n\n`;
      }
    } else if (input.reviewIds.length > 0) {
      content += `## Analises Periodicas\n\n`;
      content += `_Nenhuma analise encontrada para os IDs selecionados._\n\n`;
      content += `---\n\n`;
    }

    // Empty period handling - graceful message
    if (
      data.reflections.length === 0 &&
      data.reviews.length === 0 &&
      standaloneQuestions.length === 0
    ) {
      content += `_Nenhum conteudo encontrado para este periodo. Reflexoes, questoes e analises geradas por IA local aparecerao aqui quando disponiveis._\n\n`;
      content += `---\n\n`;
    }

    content += `Exportado em: ${new Date().toLocaleString("pt-BR")}\n`;

    return content;
  }

  /**
   * T060: Check performance budget and log violations
   */
  private checkPerformanceBudget(timings: ExportTimings): void {
    const violations: string[] = [];

    if (timings.gatherDataMs > PERF_BUDGET.gatherDataMs) {
      violations.push(
        `gatherData ${timings.gatherDataMs}ms > ${PERF_BUDGET.gatherDataMs}ms`,
      );
    }
    if (timings.generateMarkdownMs > PERF_BUDGET.generateMarkdownMs) {
      violations.push(
        `generateMarkdown ${timings.generateMarkdownMs}ms > ${PERF_BUDGET.generateMarkdownMs}ms`,
      );
    }
    if (timings.totalMs > PERF_BUDGET.totalMs) {
      violations.push(`total ${timings.totalMs}ms > ${PERF_BUDGET.totalMs}ms`);
    }

    timings.violations = violations;
    timings.withinBudget = violations.length === 0;

    if (!timings.withinBudget) {
      console.warn(
        "[MarkdownExportService] Performance budget exceeded:",
        violations.join("; "),
        JSON.stringify(timings),
      );
    }
  }

  /**
   * Generate export bundle with markdown content
   * T057: Fetches actual llama.rn-generated content from stores
   * T060: Tracks performance timing
   */
  async generateExport(
    input: MarkdownExportInput,
  ): Promise<Result<ExportResult>> {
    const stopTiming = this.metrics.startTiming("markdown_export");
    const totalStart = Date.now();
    const timings: ExportTimings = {
      gatherDataMs: 0,
      generateMarkdownMs: 0,
      totalMs: 0,
      withinBudget: true,
      violations: [],
    };

    // Validate input
    if (!input.periodStart || !input.periodEnd) {
      return err(
        createError("VALIDATION_ERROR", "Period start and end are required"),
      );
    }

    // T057: Gather actual content from stores
    const gatherStart = Date.now();
    const data = await this.gatherExportData(input);
    timings.gatherDataMs = Date.now() - gatherStart;

    // T057: Generate markdown with actual content
    const mdStart = Date.now();
    const markdownContent = this.generateMarkdownContent(input, data);
    timings.generateMarkdownMs = Date.now() - mdStart;

    timings.totalMs = Date.now() - totalStart;
    this.checkPerformanceBudget(timings);

    // Create bundle
    const bundleResult = ExportBundle.create(
      input.periodStart,
      input.periodEnd,
      input.reflectionIds,
      input.questionSetIds,
      input.reviewIds,
      markdownContent,
    );

    if (!bundleResult.success) {
      stopTiming({ ...timings, success: false });
      return err(bundleResult.error);
    }

    const bundle = bundleResult.data;

    // Persist
    const saveResult = await this.repository.save(bundle);
    if (!saveResult.success) {
      stopTiming({ ...timings, success: false });
      return err(saveResult.error);
    }

    stopTiming({
      ...timings,
      success: true,
      reflectionCount: data.reflections.length,
      reviewCount: data.reviews.length,
    });

    return ok({
      id: bundle.id,
      fileName: bundle.fileName,
      fileSize: bundle.getFileSize(),
      sectionCount: bundle.getSectionCount(),
    });
  }

  /**
   * Retrieve export by ID
   */
  async getExport(id: string): Promise<Result<ExportBundle>> {
    return this.repository.getById(id);
  }

  /**
   * Delete export bundle
   */
  async deleteExport(id: string): Promise<Result<void>> {
    return this.repository.delete(id);
  }

  /**
   * List all exports
   */
  async listExports(): Promise<Result<ExportBundle[]>> {
    return this.repository.listAll();
  }
}

let serviceInstance: MarkdownExportService | null = null;

export function getMarkdownExportService(): MarkdownExportService {
  if (!serviceInstance) {
    serviceInstance = new MarkdownExportService();
  }
  return serviceInstance;
}
