/**
 * T048: Export Bundle Model
 * Domain model for markdown export bundles with validation
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";

export interface ExportBundleRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  includedReflectionIds: string[];
  includedQuestionSetIds: string[];
  includedReviewIds: string[];
  markdownContent: string;
  fileName: string;
  createdAt: number;
  state: "draft" | "ready" | "error";
  errorMessage?: string;
}

export class ExportBundle {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly includedReflectionIds: string[];
  readonly includedQuestionSetIds: string[];
  readonly includedReviewIds: string[];
  readonly markdownContent: string;
  readonly fileName: string;
  readonly createdAt: number;
  readonly state: "draft" | "ready" | "error";
  readonly errorMessage?: string;

  constructor(record: ExportBundleRecord) {
    this.id = record.id;
    this.periodStart = record.periodStart;
    this.periodEnd = record.periodEnd;
    this.includedReflectionIds = record.includedReflectionIds;
    this.includedQuestionSetIds = record.includedQuestionSetIds;
    this.includedReviewIds = record.includedReviewIds;
    this.markdownContent = record.markdownContent;
    this.fileName = record.fileName;
    this.createdAt = record.createdAt;
    this.state = record.state;
    this.errorMessage = record.errorMessage;
  }

  static create(
    periodStart: string,
    periodEnd: string,
    includedReflectionIds: string[],
    includedQuestionSetIds: string[],
    includedReviewIds: string[],
    markdownContent: string,
  ): Result<ExportBundle> {
    // Validate ISO date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
      return err(
        createError("VALIDATION_ERROR", "Invalid period start format"),
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      return err(createError("VALIDATION_ERROR", "Invalid period end format"));
    }

    // Validate date ordering
    if (new Date(periodStart) > new Date(periodEnd)) {
      return err(
        createError("VALIDATION_ERROR", "Start date cannot be after end date"),
      );
    }

    // Validate markdown content
    if (
      typeof markdownContent !== "string" ||
      markdownContent.trim().length === 0
    ) {
      return err(
        createError("VALIDATION_ERROR", "Markdown content cannot be empty"),
      );
    }

    // Validate pt-BR requirement
    const hasPtBR = /[àáâãäèéêëìíîïòóôõöùúûüçñ]/i.test(markdownContent);
    if (!hasPtBR) {
      return err(
        createError("VALIDATION_ERROR", "Content must contain Portuguese text"),
      );
    }

    const fileName = `reflexoes_${periodStart}_${periodEnd}.md`;
    const id = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return ok(
      new ExportBundle({
        id,
        periodStart,
        periodEnd,
        includedReflectionIds,
        includedQuestionSetIds,
        includedReviewIds,
        markdownContent,
        fileName,
        createdAt: Date.now(),
        state: "ready",
      }),
    );
  }

  static fromRecord(record: ExportBundleRecord): ExportBundle {
    return new ExportBundle(record);
  }

  toRecord(): ExportBundleRecord {
    return {
      id: this.id,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      includedReflectionIds: this.includedReflectionIds,
      includedQuestionSetIds: this.includedQuestionSetIds,
      includedReviewIds: this.includedReviewIds,
      markdownContent: this.markdownContent,
      fileName: this.fileName,
      createdAt: this.createdAt,
      state: this.state,
      errorMessage: this.errorMessage,
    };
  }

  getFileSize(): number {
    return new Blob([this.markdownContent]).size;
  }

  getSectionCount(): number {
    // Count markdown headers
    const headers = (this.markdownContent.match(/^#+\s/gm) || []).length;
    return headers;
  }
}
