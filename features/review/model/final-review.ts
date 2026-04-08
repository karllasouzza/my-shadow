/**
 * T037: FinalReview domain model
 *
 * Represents a period-based synthesis of reflections with recurring patterns,
 * emotional triggers, and next inquiry prompts grounded in Jungian shadow work.
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";

export interface FinalReviewRecord {
  id: string;
  periodStart: string; // ISO date: yyyy-mm-dd
  periodEnd: string; // ISO date: yyyy-mm-dd
  reflectionIds: string[]; // FK references
  summary: string; // Main synthesis in pt-BR
  recurringPatterns: string[]; // 0+ patterns identified
  emotionalTriggers: string[]; // 0+ triggers
  nextInquiryPrompts: string[]; // 1+ recommended questions
  generationMode: "normal" | "fallback_template" | "retry_result";
  modelId?: string; // ai runtime identifier
  modelVersion?: string; // model version used
  generatedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * FinalReview domain class
 */
export class FinalReview {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly reflectionIds: string[];
  readonly summary: string;
  readonly recurringPatterns: string[];
  readonly emotionalTriggers: string[];
  readonly nextInquiryPrompts: string[];
  readonly generationMode: "normal" | "fallback_template" | "retry_result";
  readonly modelId?: string;
  readonly modelVersion?: string;
  readonly generatedAt: string;
  readonly updatedAt: string;

  constructor(data: FinalReviewRecord) {
    this.id = data.id;
    this.periodStart = data.periodStart;
    this.periodEnd = data.periodEnd;
    this.reflectionIds = data.reflectionIds;
    this.summary = data.summary;
    this.recurringPatterns = data.recurringPatterns;
    this.emotionalTriggers = data.emotionalTriggers;
    this.nextInquiryPrompts = data.nextInquiryPrompts;
    this.generationMode = data.generationMode;
    this.modelId = data.modelId;
    this.modelVersion = data.modelVersion;
    this.generatedAt = data.generatedAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Create a new FinalReview from generation result
   */
  static create(
    periodStart: string,
    periodEnd: string,
    reflectionIds: string[],
    summary: string,
    recurringPatterns: string[],
    emotionalTriggers: string[],
    nextInquiryPrompts: string[],
    generationMode: "normal" | "fallback_template" | "retry_result",
    modelId?: string,
    modelVersion?: string,
  ): Result<FinalReview> {
    // Validate dates
    if (!this.isValidIsoDate(periodStart)) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "periodStart must be valid ISO date (yyyy-mm-dd)",
        ),
      );
    }

    if (!this.isValidIsoDate(periodEnd)) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "periodEnd must be valid ISO date (yyyy-mm-dd)",
        ),
      );
    }

    // Verify start <= end
    if (new Date(periodStart) > new Date(periodEnd)) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "periodStart must not exceed periodEnd",
        ),
      );
    }

    // Validate content
    if (!summary || summary.trim().length === 0) {
      return err(createError("VALIDATION_ERROR", "summary must not be empty"));
    }

    // At least one next inquiry prompt is required
    if (nextInquiryPrompts.length === 0) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "nextInquiryPrompts must include at least one prompt",
        ),
      );
    }

    // Verify Portuguese content (basic check for pt-BR characters)
    const ptBrCharRegex = /[a-záàâãéèêíìîóòôõöúùûü]/;
    if (!ptBrCharRegex.test(summary)) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "summary must be in Brazilian Portuguese",
        ),
      );
    }

    const now = new Date().toISOString();

    return ok(
      new FinalReview({
        id: FinalReview.generateId(),
        periodStart,
        periodEnd,
        reflectionIds,
        summary,
        recurringPatterns,
        emotionalTriggers,
        nextInquiryPrompts,
        generationMode,
        modelId,
        modelVersion,
        generatedAt: now,
        updatedAt: now,
      }),
    );
  }

  /**
   * Reconstruct from persisted data
   */
  static fromRecord(record: FinalReviewRecord): Result<FinalReview> {
    try {
      return ok(new FinalReview(record));
    } catch (error) {
      return err(
        createError(
          "VALIDATION_ERROR",
          `Failed to reconstruct review: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  /**
   * Convert to persistable record
   */
  toRecord(): FinalReviewRecord {
    return {
      id: this.id,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      reflectionIds: this.reflectionIds,
      summary: this.summary,
      recurringPatterns: this.recurringPatterns,
      emotionalTriggers: this.emotionalTriggers,
      nextInquiryPrompts: this.nextInquiryPrompts,
      generationMode: this.generationMode,
      modelId: this.modelId,
      modelVersion: this.modelVersion,
      generatedAt: this.generatedAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Check if a given date is in this review's period
   */
  includesDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    const start = new Date(this.periodStart);
    const end = new Date(this.periodEnd);
    return date >= start && date <= end;
  }

  /**
   * Get period as human-readable string
   */
  getPeriodLabel(locale: "pt-BR" | "en" = "pt-BR"): string {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const formatter = new Intl.DateTimeFormat(locale, options);

    const start = formatter.format(new Date(this.periodStart));
    const end = formatter.format(new Date(this.periodEnd));

    return locale === "pt-BR" ? `${start} a ${end}` : `${start} to ${end}`;
  }

  // Private helpers
  private static generateId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static isValidIsoDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
}
