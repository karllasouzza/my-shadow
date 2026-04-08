/**
 * T039: Final review generation service
 *
 * Orchestrates review generation from reflection set with support for normal,
 * fallback, and retry modes.
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { FinalReview } from "../model/final-review";
import { getReviewRepository } from "../repository/review-repository";

export class ReviewService {
  private reviewRepository = getReviewRepository();

  /**
   * Generate final review for period
   */
  async generateFinalReview(
    periodStart: string,
    periodEnd: string,
    reflectionIds: string[],
  ): Promise<
    Result<{
      id: string;
      summary: string;
      patterns: string[];
      triggers: string[];
      prompts: string[];
    }>
  > {
    try {
      if (reflectionIds.length === 0) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Cannot generate review without reflections",
          ),
        );
      }

      // Mock generation logic
      const summary =
        reflectionIds.length === 1
          ? "Durante este período, você ofereceu uma reflexão valiosa."
          : `Ao longo deste período, suas ${reflectionIds.length} reflexões revelam padrões significativos de autoconhecimento.`;

      const result = FinalReview.create(
        periodStart,
        periodEnd,
        reflectionIds,
        summary,
        reflectionIds.length > 1 ? ["Padrão de consciência crescente"] : [],
        ["Exploração em andamento"],
        [
          "Como posso aprofundar essa linha de investigação?",
          "Qual é a sabedoria nesta sombra?",
        ],
        "normal",
      );

      if (!result.success) {
        return err(result.error);
      }

      const review = result.data;
      await this.reviewRepository.save(review.toRecord());

      return ok({
        id: review.id,
        summary: review.summary,
        patterns: review.recurringPatterns,
        triggers: review.emotionalTriggers,
        prompts: review.nextInquiryPrompts,
      });
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Failed to generate review: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  /**
   * Get existing review
   */
  async getReview(
    reviewId: string,
  ): Promise<Result<{ id: string; periodStart: string; periodEnd: string }>> {
    const result = await this.reviewRepository.getById(reviewId);
    if (!result.success) return err(result.error);
    if (!result.data) {
      return err(createError("NOT_FOUND", `Review ${reviewId} not found`));
    }
    return ok({
      id: result.data.id,
      periodStart: result.data.periodStart,
      periodEnd: result.data.periodEnd,
    });
  }

  /**
   * Delete review
   */
  async deleteReview(reviewId: string): Promise<Result<void>> {
    return await this.reviewRepository.delete(reviewId);
  }
}

let reviewService: ReviewService;

export function getReviewService(): ReviewService {
  if (!reviewService) {
    reviewService = new ReviewService();
  }
  return reviewService;
}
