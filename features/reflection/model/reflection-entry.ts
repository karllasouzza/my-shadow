/**
 * T023: ReflectionEntry domain model
 * 
 * Represents a daily reflection entry with validation rules and state management.
 */

import { Result, ok, err, createError } from "../../../shared/utils/app-error";

export interface ReflectionEntryData {
  id: string;
  entryDate: string; // yyyy-mm-dd
  content: string; // 1..5000 chars
  moodTags?: string[]; // max 8
  triggerTags?: string[]; // max 12
  sourceLocale: string; // pt-BR
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export class ReflectionEntry {
  readonly id: string;
  readonly entryDate: string;
  content: string;
  moodTags: string[];
  triggerTags: string[];
  readonly sourceLocale: string;
  readonly createdAt: string;
  updatedAt: string;

  constructor(data: ReflectionEntryData) {
    this.id = data.id;
    this.entryDate = data.entryDate;
    this.content = data.content;
    this.moodTags = data.moodTags || [];
    this.triggerTags = data.triggerTags || [];
    this.sourceLocale = data.sourceLocale;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Validate reflection entry
   */
  static validate(data: Partial<ReflectionEntryData>): Result<void> {
    // Validate content
    if (!data.content || data.content.trim().length === 0) {
      return err(
        createError("VALIDATION_ERROR", "Content cannot be empty")
      );
    }

    if (data.content.length > 5000) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Content must be 5000 characters or less"
        )
      );
    }

    // Validate date
    if (data.entryDate && !this.isValidDate(data.entryDate)) {
      return err(
        createError("VALIDATION_ERROR", "Date must be in yyyy-mm-dd format")
      );
    }

    // Validate locale
    if (data.sourceLocale && data.sourceLocale !== "pt-BR") {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Source locale must be pt-BR in v1"
        )
      );
    }

    // Validate mood tags
    if (data.moodTags && data.moodTags.length > 8) {
      return err(
        createError("VALIDATION_ERROR", "Maximum 8 mood tags allowed")
      );
    }

    // Validate trigger tags
    if (data.triggerTags && data.triggerTags.length > 12) {
      return err(
        createError("VALIDATION_ERROR", "Maximum 12 trigger tags allowed")
      );
    }

    return ok(void 0);
  }

  /**
   * Create a new reflection
   */
  static create(
    content: string,
    entryDate: string = new Date().toISOString().split("T")[0],
    moodTags?: string[],
    triggerTags?: string[]
  ): Result<ReflectionEntry> {
    const validation = this.validate({
      content,
      entryDate,
      moodTags,
      triggerTags,
      sourceLocale: "pt-BR",
    });

    if (!validation.success) {
      return validation;
    }

    const now = new Date().toISOString();
    const id = this.generateId();

    return ok(
      new ReflectionEntry({
        id,
        entryDate,
        content,
        moodTags,
        triggerTags,
        sourceLocale: "pt-BR",
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Update content
   */
  updateContent(newContent: string): Result<void> {
    const validation = ReflectionEntry.validate({
      content: newContent,
      sourceLocale: this.sourceLocale,
    });

    if (!validation.success) {
      return validation;
    }

    this.content = newContent;
    this.updatedAt = new Date().toISOString();
    return ok(void 0);
  }

  /**
   * Convert to storage format
   */
  toData(): ReflectionEntryData {
    return {
      id: this.id,
      entryDate: this.entryDate,
      content: this.content,
      moodTags: this.moodTags,
      triggerTags: this.triggerTags,
      sourceLocale: this.sourceLocale,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Helper: Validate date format
   */
  private static isValidDate(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
