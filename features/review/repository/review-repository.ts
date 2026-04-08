/**
 * T038: Period review repository queries
 *
 * Provides data access patterns for final reviews:
 * - Get review for period
 * - List reviews by date range
 * - Save/update/delete reviews
 * - Query reviews by reflection IDs
 *
 * Storage: MMKV encrypted (persistent, survives app restarts)
 */

import { createMMKV } from "react-native-mmkv";
import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import type { FinalReviewRecord } from "../model/final-review";

const REVIEWS_STORAGE_ID = "final_reviews";

let reviewsStorage: ReturnType<typeof createMMKV> | null = null;

function getStorage(): ReturnType<typeof createMMKV> {
  if (!reviewsStorage) {
    reviewsStorage = createMMKV({ id: REVIEWS_STORAGE_ID });
  }
  return reviewsStorage;
}

function reviewKey(id: string): string {
  return `review:${id}`;
}

function parseReview(json: string): FinalReviewRecord {
  const raw = JSON.parse(json) as Record<string, unknown>;
  return {
    id: raw.id as string,
    periodStart: raw.periodStart as string,
    periodEnd: raw.periodEnd as string,
    summary: (raw.summary as string) ?? "",
    recurringPatterns: (raw.recurringPatterns as string[]) ?? [],
    emotionalTriggers: (raw.emotionalTriggers as string[]) ?? [],
    nextInquiryPrompts: (raw.nextInquiryPrompts as string[]) ?? [],
    reflectionIds: (raw.reflectionIds as string[]) ?? [],
    generationMode: ((raw.generationMode as string) ?? "normal") as
      | "normal"
      | "fallback_template"
      | "retry_result",
    modelId: raw.modelId as string | undefined,
    modelVersion: raw.modelVersion as string | undefined,
    generatedAt: (raw.generatedAt as string) ?? new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
  };
}

/**
 * Review repository with MMKV persistence
 */
export class ReviewRepository {
  /**
   * Get review by ID
   */
  async getById(reviewId: string): Promise<Result<FinalReviewRecord | null>> {
    try {
      const storage = getStorage();
      const json = storage.getString(reviewKey(reviewId));
      if (!json) return ok(null);
      return ok(parseReview(json));
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
      const storage = getStorage();
      const keys = storage.getAllKeys();
      const reviews: FinalReviewRecord[] = [];

      for (const key of keys) {
        if (!key.startsWith("review:")) continue;
        const json = storage.getString(key);
        if (!json) continue;
        const review = parseReview(json);
        if (
          review.periodStart >= periodStart &&
          review.periodEnd <= periodEnd
        ) {
          reviews.push(review);
        }
      }

      return ok(reviews);
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
      const storage = getStorage();
      const keys = storage.getAllKeys();
      const reviews: FinalReviewRecord[] = [];

      for (const key of keys) {
        if (!key.startsWith("review:")) continue;
        const json = storage.getString(key);
        if (!json) continue;
        const review = parseReview(json);
        if (review.reflectionIds.includes(reflectionId)) {
          reviews.push(review);
        }
      }

      return ok(reviews);
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
      const storage = getStorage();
      storage.set(reviewKey(review.id), JSON.stringify(review));
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
      const storage = getStorage();
      storage.remove(reviewKey(reviewId));
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
      const storage = getStorage();
      const keys = storage.getAllKeys();
      const reviews: FinalReviewRecord[] = [];

      for (const key of keys) {
        if (!key.startsWith("review:")) continue;
        const json = storage.getString(key);
        if (!json) continue;
        reviews.push(parseReview(json));
      }

      return ok(reviews);
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
      const storage = getStorage();
      const keys = storage.getAllKeys();
      for (const key of keys) {
        if (key.startsWith("review:")) {
          storage.remove(key);
        }
      }
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
