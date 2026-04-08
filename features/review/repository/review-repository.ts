/**
 * T038: Period review repository queries
 *
 * Provides data access patterns for final reviews:
 * - Get review for period
 * - List reviews by date range
 * - Save/update/delete reviews
 * - Query reviews by reflection IDs
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import type { FinalReviewRecord } from "../model/final-review";

/**
 * Review repository interface
 */
export class ReviewRepository {
  private reviews: Map<string, FinalReviewRecord> = new Map();

  /**
   * Get review by ID
   */
  async getById(reviewId: string): Promise<Result<FinalReviewRecord | null>> {
    try {
      const review = this.reviews.get(reviewId);
      return ok(review || null);
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
      const reviews = Array.from(this.reviews.values()).filter(
        (r) => r.periodStart >= periodStart && r.periodEnd <= periodEnd,
      );
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
      const reviews = Array.from(this.reviews.values()).filter((r) =>
        r.reflectionIds.includes(reflectionId),
      );
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
      this.reviews.set(review.id, review);
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
      this.reviews.delete(reviewId);
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
      return ok(Array.from(this.reviews.values()));
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
      this.reviews.clear();
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
