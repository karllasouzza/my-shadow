/**
 * T024: GuidedQuestionSet domain model
 * 
 * Represents a set of guided questions generated for a reflection.
 */

import { Result, ok, err, createError } from "../../../shared/utils/app-error";

export type GenerationMode = "normal" | "fallback_template" | "retry_result";

export interface GuidedQuestionSetData {
  id: string;
  reflectionId: string;
  generationMode: GenerationMode;
  questions: string[];
  retrievalContextReflectionIds: string[];
  modelId: string;
  modelVersion: string;
  generatedAt: string;
}

export class GuidedQuestionSet {
  readonly id: string;
  readonly reflectionId: string;
  readonly generationMode: GenerationMode;
  readonly questions: string[];
  readonly retrievalContextReflectionIds: string[];
  readonly modelId: string;
  readonly modelVersion: string;
  readonly generatedAt: string;

  constructor(data: GuidedQuestionSetData) {
    this.id = data.id;
    this.reflectionId = data.reflectionId;
    this.generationMode = data.generationMode;
    this.questions = data.questions;
    this.retrievalContextReflectionIds = data.retrievalContextReflectionIds;
    this.modelId = data.modelId;
    this.modelVersion = data.modelVersion;
    this.generatedAt = data.generatedAt;
  }

  /**
   * Validate question set data
   */
  static validate(data: Partial<GuidedQuestionSetData>): Result<void> {
    // Validate questions
    if (!data.questions || data.questions.length === 0) {
      return err(
        createError("VALIDATION_ERROR", "At least one question is required")
      );
    }

    if (data.questions.length > 8) {
      return err(
        createError("VALIDATION_ERROR", "Maximum 8 questions allowed")
      );
    }

    // Validate all questions are non-empty strings in Portuguese
    for (const q of data.questions) {
      if (typeof q !== "string" || q.trim().length === 0) {
        return err(
          createError("VALIDATION_ERROR", "All questions must be non-empty strings")
        );
      }

      // All should be Brazilian Portuguese (simplified check)
      if (!this.isProbablyPortuguese(q)) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "All questions must be in Brazilian Portuguese"
          )
        );
      }
    }

    // Validate generation mode
    if (
      data.generationMode &&
      !["normal", "fallback_template", "retry_result"].includes(data.generationMode)
    ) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Invalid generation mode. Must be normal, fallback_template, or retry_result"
        )
      );
    }

    // Validate reflection ID exists
    if (!data.reflectionId) {
      return err(
        createError("VALIDATION_ERROR", "Reflection ID is required")
      );
    }

    return ok(void 0);
  }

  /**
   * Create a new question set
   */
  static create(
    reflectionId: string,
    questions: string[],
    generationMode: GenerationMode = "normal",
    retrievalContextReflectionIds: string[] = [],
    modelId: string = "llama2-7b",
    modelVersion: string = "v1"
  ): Result<GuidedQuestionSet> {
    const validation = this.validate({
      reflectionId,
      questions,
      generationMode,
      retrievalContextReflectionIds,
      modelId,
      modelVersion,
    });

    if (!validation.success) {
      return validation;
    }

    const id = this.generateId();
    const now = new Date().toISOString();

    return ok(
      new GuidedQuestionSet({
        id,
        reflectionId,
        generationMode,
        questions,
        retrievalContextReflectionIds,
        modelId,
        modelVersion,
        generatedAt: now,
      })
    );
  }

  /**
   * Check if this is a fallback result
   */
  isFallback(): boolean {
    return this.generationMode === "fallback_template";
  }

  /**
   * Check if this is a retry result
   */
  isRetry(): boolean {
    return this.generationMode === "retry_result";
  }

  /**
   * Convert to storage format
   */
  toData(): GuidedQuestionSetData {
    return {
      id: this.id,
      reflectionId: this.reflectionId,
      generationMode: this.generationMode,
      questions: this.questions,
      retrievalContextReflectionIds: this.retrievalContextReflectionIds,
      modelId: this.modelId,
      modelVersion: this.modelVersion,
      generatedAt: this.generatedAt,
    };
  }

  /**
   * Helper: Check if text looks like Portuguese
   */
  private static isProbablyPortuguese(text: string): boolean {
    // Simple heuristic - check for Portuguese words or diacritics
    const ptIndicators = /[áàâãéèêíìîóòôõöúùûü]|\b(que|é|de|para|com|um|uma)\b/i;
    return ptIndicators.test(text);
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `qs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
