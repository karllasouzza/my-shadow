/**
 * T049: Markdown Export Service
 * Orchestrates markdown generation and export bundle creation
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { ExportBundle } from "../model/export-bundle";
import {
    ExportRepository,
    getExportRepository,
} from "../repository/export-repository";

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

export class MarkdownExportService {
  private repository: ExportRepository;

  constructor(repository?: ExportRepository) {
    this.repository = repository || getExportRepository();
  }

  /**
   * Generate markdown content from reflection set
   */
  private generateMarkdownContent(input: MarkdownExportInput): string {
    const dateRange = `${input.periodStart} até ${input.periodEnd}`;
    let content = `# Reflexões de ${dateRange}\n\n`;

    // Reflections section
    if (input.reflectionIds.length > 0) {
      content += `## Reflexões\n\n`;
      content += `Total de reflexões: ${input.reflectionIds.length}\n\n`;
    }

    // Question sets section
    if (input.questionSetIds.length > 0) {
      content += `## Conjuntos de Questões\n\n`;
      content += `Total de conjuntos: ${input.questionSetIds.length}\n\n`;
    }

    // Reviews section
    if (input.reviewIds.length > 0) {
      content += `## Análises Periódicas\n\n`;
      content += `Total de análises: ${input.reviewIds.length}\n\n`;
    }

    content += `---\n\nExportado em: ${new Date().toLocaleString("pt-BR")}\n`;

    return content;
  }

  /**
   * Generate export bundle with markdown content
   */
  async generateExport(
    input: MarkdownExportInput,
  ): Promise<Result<ExportResult>> {
    // Validate input
    if (!input.periodStart || !input.periodEnd) {
      return err(
        createError("VALIDATION_ERROR", "Period start and end are required"),
      );
    }

    // Generate markdown
    const markdownContent = this.generateMarkdownContent(input);

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
      return err(bundleResult.error);
    }

    const bundle = bundleResult.data;

    // Persist
    const saveResult = await this.repository.save(bundle);
    if (!saveResult.success) {
      return err(saveResult.error);
    }

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
