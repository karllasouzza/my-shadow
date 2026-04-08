/**
 * T027: Hard-delete reflection use case with cascade delete
 *
 * Implements hard-delete semantics for reflections, which cascades to:
 * - GuidedQuestionSet records linked to this reflection
 * - FinalReview records that reference this reflection
 * - GenerationJob records linked to deleted artifacts
 *
 * Per spec: "Deleting a reflection MUST immediately hard-delete the reflection
 * and all linked generated artifacts in cascade with no recovery option."
 */

import { getReflectionCascadeDelete } from "../../../shared/storage/reflection-cascade-delete";
import { getGenerationJobStore } from "../../../shared/storage/generation-job-store";
import { getReflectionStore } from "../../../shared/storage/encrypted-reflection-store";
import { Result, ok, err, createError } from "../../../shared/utils/app-error";

export class DeleteReflectionCascadeService {
  private reflectionStore = getReflectionStore();
  private cascadeDelete = getReflectionCascadeDelete();
  private jobStore = getGenerationJobStore();

  /**
   * Hard-delete a reflection and cascade-delete all linked artifacts
   *
   * @param reflectionId ID of the reflection to delete
   * @returns Result indicating success or failure with error details
   */
  async deleteReflectionCascade(reflectionId: string): Promise<Result<void>> {
    try {
      // Verify reflection exists before deleting
      const existsResult = await this.reflectionStore.getReflection(
        reflectionId,
      );
      if (!existsResult.success) {
        return err(existsResult.error);
      }
      if (!existsResult.data) {
        return err(
          createError("NOT_FOUND", `Reflection ${reflectionId} does not exist`),
        );
      }

      // Execute cascade delete via coordinator
      const cascadeResult = await this.cascadeDelete.deleteReflectionCascade(
        reflectionId,
      );

      if (!cascadeResult.success) {
        return err(cascadeResult.error);
      }

      // Cancel and clean up any queued generation jobs for this reflection
      await this.cleanupGenerationJobs(reflectionId);

      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Unexpected error deleting reflection: ${error instanceof Error ? error.message : String(error)}`,
          { reflectionId },
        ),
      );
    }
  }

  /**
   * Cancel and remove generation jobs for a reflection
   *
   * @private
   */
  private async cleanupGenerationJobs(reflectionId: string): Promise<void> {
    try {
      // Get all queued jobs for this reflection
      const jobsResult = await this.jobStore.getQueuedJobs();
      if (!jobsResult.success || !jobsResult.data) {
        return;
      }

      // Cancel and delete each job
      for (const job of jobsResult.data) {
        if (job.targetRefId === reflectionId) {
          await this.jobStore.updateJob(job.id, {
            status: "cancelled",
          });
          // Note: Hard-delete is handled by repository implementation
          await this.jobStore.deleteJob(job.id);
        }
      }
    } catch (error) {
      // Log but don't throw; cascade delete already succeeded
      console.warn(
        `Failed to clean up generation jobs for reflection ${reflectionId}:`,
        error,
      );
    }
  }
}

/**
 * Service singleton accessor
 */
let deleteService: DeleteReflectionCascadeService;

export function getDeleteReflectionCascadeService(): DeleteReflectionCascadeService {
  if (!deleteService) {
    deleteService = new DeleteReflectionCascadeService();
  }
  return deleteService;
}
