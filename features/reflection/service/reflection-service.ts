/**
 * T026: Reflection creation and guided question service
 *
 * Orchestrates creation of reflections and generation of guided questions
 * with support for normal, fallback, and retry modes.
 */

import { getFallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import { getPtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import { getGenerationJobStore } from "../../../shared/storage/generation-job-store";
import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { getPerformanceMetrics } from "../../../shared/utils/performance-metrics";
import { GuidedQuestionSet } from "../model/guided-question-set";
import { ReflectionEntry } from "../model/reflection-entry";
import { getReflectionRepository } from "./reflection-repository";

export class ReflectionService {
  private repository = getReflectionRepository();
  private toneGuard = getPtBRJungianGuard();
  private fallbackProvider = getFallbackPromptProvider();
  private jobStore = getGenerationJobStore();
  private metrics = getPerformanceMetrics();

  /**
   * Create a new reflection
   */
  async createReflection(
    content: string,
    entryDate?: string,
    moodTags?: string[],
    triggerTags?: string[],
  ): Promise<Result<ReflectionEntry>> {
    const stopTiming = this.metrics.startTiming("create_reflection");

    try {
      // Validate language and tone
      const validationResult = this.toneGuard.validate(content);
      if (!validationResult.success) {
        return err(validationResult.error);
      }

      // Create reflection entry
      const entryResult = ReflectionEntry.create(
        content,
        entryDate,
        moodTags,
        triggerTags,
      );

      if (!entryResult.success) {
        return err(entryResult.error);
      }

      const entry = entryResult.data;

      // Save to persistence
      const saveResult = await this.repository.save(entry);
      if (!saveResult.success) {
        return err(saveResult.error);
      }

      stopTiming({ reflectionId: entry.id });
      return ok(entry);
    } catch (error) {
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Failed to create reflection",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Generate guided questions for a reflection
   */
  async generateGuidedQuestions(
    reflectionId: string,
    augmentedGeneration: boolean = true,
    contextWindowDays: number = 30,
  ): Promise<
    Result<{
      questionSet: GuidedQuestionSet;
      queuedRetryJobId?: string;
    }>
  > {
    const stopTiming = this.metrics.startTiming("generate_guided_questions");

    try {
      // Verify reflection exists
      const reflectionResult = await this.repository.getById(reflectionId);
      if (!reflectionResult.success) {
        return err(reflectionResult.error);
      }

      if (!reflectionResult.data) {
        return err(
          createError("NOT_FOUND", "Reflection not found", { reflectionId }),
        );
      }

      // TODO: In a real implementation, this would:
      // 1. Retrieve the reflection content
      // 2. Perform RAG retrieval using context window
      // 3. Call local AI runtime for generation
      // 4. Validate tone and language

      // For now, use fallback implementation
      const fallbackQuestions =
        this.fallbackProvider.getGuidedQuestionsFallback();

      // Create question set with fallback mode
      const qSetResult = GuidedQuestionSet.create(
        reflectionId,
        fallbackQuestions,
        "fallback_template",
        [reflectionId],
        "llama2-7b",
        "v1",
      );

      if (!qSetResult.success) {
        return err(qSetResult.error);
      }

      const questionSet = qSetResult.data;

      // Save question set
      const saveResult = await this.repository.saveQuestionSet(questionSet);
      if (!saveResult.success) {
        return err(saveResult.error);
      }

      // Create retry job for proper generation
      const jobResult = await this.jobStore.createJob(
        "guided_questions",
        reflectionId,
        3,
      );

      let queuedRetryJobId: string | undefined;
      if (jobResult.success) {
        queuedRetryJobId = jobResult.data.id;
      }

      stopTiming({
        reflectionId,
        generationMode: "fallback_template",
        retried: !!queuedRetryJobId,
      });

      return ok({
        questionSet,
        queuedRetryJobId,
      });
    } catch (error) {
      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Failed to generate guided questions",
          { reflectionId },
          error as Error,
        ),
      );
    }
  }

  /**
   * Get guided questions for a reflection
   */
  async getGuidedQuestions(
    reflectionId: string,
  ): Promise<Result<GuidedQuestionSet[]>> {
    try {
      return await this.repository.getQuestionSetsByReflection(reflectionId);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve guided questions",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Delete a reflection and cascade delete dependent artifacts
   */
  async deleteReflectionCascade(reflectionId: string): Promise<Result<void>> {
    try {
      // Delete all question sets first
      const questionsResult = await this.getGuidedQuestions(reflectionId);
      if (questionsResult.success) {
        for (const qSet of questionsResult.data) {
          await this.repository.deleteQuestionSet(qSet.id);
        }
      }

      // Delete any pending generation jobs
      const jobsResult = await this.jobStore.getQueuedJobs();
      if (jobsResult.success) {
        for (const job of jobsResult.data) {
          if (
            job.targetType === "guided_questions" &&
            job.targetRefId === reflectionId
          ) {
            await this.jobStore.deleteJob(job.id);
          }
        }
      }

      // Delete the reflection itself
      return await this.repository.delete(reflectionId);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to delete reflection",
          { reflectionId },
          error as Error,
        ),
      );
    }
  }
}

// Singleton
let serviceInstance: ReflectionService;
export const getReflectionService = (): ReflectionService => {
  if (!serviceInstance) {
    serviceInstance = new ReflectionService();
  }
  return serviceInstance;
};
