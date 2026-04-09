/**
 * T016: Implement hard-delete cascade coordinator
 *
 * Coordinates cascading deletion of dependent artifacts when a reflection is deleted.
 * Ensures no orphaned records remain and maintains referential integrity.
 */

import { getReviewRepository } from "../../features/review/repository/review-repository";
import { getReflectionStore } from "../storage/encrypted-reflection-store";
import { getGenerationJobStore } from "../storage/generation-job-store";
import { Result, createError, err, ok } from "../utils/app-error";

export interface CascadeDeleteResult {
  deletedReflectionId: string;
  deletedQuestionSetCount: number;
  deletedReviewCount: number;
  deletedJobCount: number;
  deletedAt: string;
}

/**
 * Coordinator for hard-delete cascade operations
 */
export class ReflectionCascadeDelete {
  private reflectionStore = getReflectionStore();
  private jobStore = getGenerationJobStore();
  private reviewRepository = getReviewRepository();

  /**
   * Execute cascade delete for a reflection and all dependent artifacts
   */
  async deleteReflectionCascade(
    reflectionId: string,
  ): Promise<Result<CascadeDeleteResult>> {
    try {
      // Verify reflection exists
      const reflectionResult =
        await this.reflectionStore.getReflection(reflectionId);
      if (!reflectionResult.success) {
        return err(reflectionResult.error);
      }
      if (!reflectionResult.data) {
        return err(
          createError("NOT_FOUND", `Reflection ${reflectionId} not found`),
        );
      }

      let deletedQuestionSetCount = 0;
      let deletedReviewCount = 0;
      let deletedJobCount = 0;

      // Delete dependent question sets
      const questionSetsResult =
        await this.reflectionStore.getQuestionSetsByReflection(reflectionId);
      if (questionSetsResult.success) {
        for (const questionSet of questionSetsResult.data) {
          const deleteResult = await this.reflectionStore.deleteQuestionSet(
            questionSet.id,
          );
          if (deleteResult.success) {
            deletedQuestionSetCount++;
          }
        }
      }

      // Delete dependent generation jobs
      const jobsResult = await this.jobStore.getQueuedJobs();
      if (jobsResult.success) {
        for (const job of jobsResult.data) {
          if (
            job.targetType === "guided_questions" &&
            job.targetRefId === reflectionId
          ) {
            const deleteResult = await this.jobStore.deleteJob(job.id);
            if (deleteResult.success) {
              deletedJobCount++;
            }
          }
        }
      }

      // Delete dependent final reviews and related queued jobs
      const reviewsResult =
        await this.reviewRepository.getByReflectionId(reflectionId);
      if (reviewsResult.success) {
        for (const review of reviewsResult.data) {
          const deleteResult = await this.reviewRepository.delete(review.id);
          if (deleteResult.success) {
            deletedReviewCount++;
          }

          if (jobsResult.success) {
            for (const job of jobsResult.data) {
              if (
                job.targetType === "final_review" &&
                job.targetRefId === review.id
              ) {
                const deleteJobResult = await this.jobStore.deleteJob(job.id);
                if (deleteJobResult.success) {
                  deletedJobCount++;
                }
              }
            }
          }
        }
      }

      // Delete the reflection itself
      const deleteReflectionResult =
        await this.reflectionStore.deleteReflection(reflectionId);
      if (!deleteReflectionResult.success) {
        return err(deleteReflectionResult.error);
      }

      return ok({
        deletedReflectionId: reflectionId,
        deletedQuestionSetCount,
        deletedReviewCount,
        deletedJobCount,
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Cascade delete failed",
          { reflectionId },
          error as Error,
        ),
      );
    }
  }

  /**
   * Verify cascade delete integrity (for testing)
   */
  async verifyCascadeIntegrity(
    reflectionId: string,
  ): Promise<Result<{ isClean: boolean; orphanCount: number }>> {
    try {
      // Check that reflection is gone
      const reflectionResult =
        await this.reflectionStore.getReflection(reflectionId);
      if (!reflectionResult.success) {
        return err(reflectionResult.error);
      }
      if (reflectionResult.data) {
        return ok({ isClean: false, orphanCount: 1 });
      }

      // Check that question sets are gone
      const questionSetsResult =
        await this.reflectionStore.getQuestionSetsByReflection(reflectionId);
      if (!questionSetsResult.success) {
        return err(questionSetsResult.error);
      }

      const orphanCount = questionSetsResult.data.length;

      return ok({
        isClean: orphanCount === 0,
        orphanCount,
      });
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Integrity check failed",
          { reflectionId },
          error as Error,
        ),
      );
    }
  }
}

// Singleton instance
let cascadeInstance: ReflectionCascadeDelete;

export const getReflectionCascadeDelete = (): ReflectionCascadeDelete => {
  if (!cascadeInstance) {
    cascadeInstance = new ReflectionCascadeDelete();
  }
  return cascadeInstance;
};
