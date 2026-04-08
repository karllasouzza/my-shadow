/**
 * T038: Period review repository queries
 *
 * Provides data access patterns for final reviews:
 * - Get review for period
 * - List reviews by date range
 * - Save/update/delete reviews
 * - Query reviews by reflection IDs
 *
 * Storage: expo-sqlite (persistent, survives app restarts)
 */

import * as SQLite from "expo-sqlite";
import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import type { FinalReviewRecord } from "../model/final-review";

const DB_NAME = "review-store.db";
const TABLE_NAME = "final_reviews";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initialized = false;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  return dbInstance;
}

export async function initReviewRepository(): Promise<void> {
  if (initialized) return;
  const db = await getDatabase();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id TEXT PRIMARY KEY NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      recurring_patterns TEXT NOT NULL DEFAULT '[]',
      trigger_themes TEXT NOT NULL DEFAULT '[]',
      next_inquiry_prompts TEXT NOT NULL DEFAULT '[]',
      reflection_ids TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'local-ai',
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  initialized = true;
}

function recordFromRow(row: Record<string, unknown>): FinalReviewRecord {
  return {
    id: row.id as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    summary: row.summary as string,
    recurringPatterns: JSON.parse(row.recurring_patterns as string) as string[],
    triggerThemes: JSON.parse(row.trigger_themes as string) as string[],
    nextInquiryPrompts: JSON.parse(
      row.next_inquiry_prompts as string,
    ) as string[],
    reflectionIds: JSON.parse(row.reflection_ids as string) as string[],
    source: row.source as string as "local-ai" | "fallback",
    generatedAt: row.generated_at as string,
  };
}

/**
 * Review repository with expo-sqlite persistence
 */
export class ReviewRepository {
  /**
   * Get review by ID
   */
  async getById(reviewId: string): Promise<Result<FinalReviewRecord | null>> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync(
        `SELECT * FROM ${TABLE_NAME} WHERE id = ?`,
        [reviewId],
      );
      if (rows.length === 0) return ok(null);
      return ok(recordFromRow(rows[0]));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Failed to get review ${reviewId}`,
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Get reviews for a period
   */
  async getByPeriod(
    periodStart: string,
    periodEnd: string,
  ): Promise<Result<FinalReviewRecord[]>> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync(
        `SELECT * FROM ${TABLE_NAME} WHERE period_start >= ? AND period_end <= ? ORDER BY generated_at DESC`,
        [periodStart, periodEnd],
      );
      return ok(rows.map(recordFromRow));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to query reviews by period",
          { periodStart, periodEnd },
          error as Error,
        ),
      );
    }
  }

  /**
   * Get reviews that reference a reflection
   */
  async getByReflectionId(
    reflectionId: string,
  ): Promise<Result<FinalReviewRecord[]>> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync(
        `SELECT * FROM ${TABLE_NAME} WHERE reflection_ids LIKE ?`,
        [`%${reflectionId}%`],
      );
      return ok(rows.map(recordFromRow));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Failed to query reviews by reflection ${reflectionId}`,
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Save (create or update) review
   */
  async save(review: FinalReviewRecord): Promise<Result<void>> {
    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLE_NAME}
          (id, period_start, period_end, summary, recurring_patterns,
           trigger_themes, next_inquiry_prompts, reflection_ids, source, generated_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          review.id,
          review.periodStart,
          review.periodEnd,
          review.summary,
          JSON.stringify(review.recurringPatterns),
          JSON.stringify(review.triggerThemes),
          JSON.stringify(review.nextInquiryPrompts),
          JSON.stringify(review.reflectionIds),
          review.source,
          review.generatedAt,
        ],
      );
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Failed to save review ${review.id}`,
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Delete review
   */
  async delete(reviewId: string): Promise<Result<void>> {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [reviewId]);
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Failed to delete review ${reviewId}`,
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * List all reviews
   */
  async listAll(): Promise<Result<FinalReviewRecord[]>> {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync(
        `SELECT * FROM ${TABLE_NAME} ORDER BY generated_at DESC`,
      );
      return ok(rows.map(recordFromRow));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to list reviews",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Clear all reviews (for testing)
   */
  async clear(): Promise<Result<void>> {
    try {
      const db = await getDatabase();
      await db.execAsync(`DELETE FROM ${TABLE_NAME}`);
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to clear reviews",
          {},
          error as Error,
        ),
      );
    }
  }
}

// Singleton
let reviewRepository: ReviewRepository;

export function getReviewRepository(): ReviewRepository {
  if (!reviewRepository) {
    reviewRepository = new ReviewRepository();
  }
  return reviewRepository;
}
