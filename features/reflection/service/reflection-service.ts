/**
 * T026: Reflection creation and guided question service
 *
 * Orchestrates creation of reflections and generation of guided questions
 * with support for normal, fallback, and retry modes.
 */

import { getFallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import { getLocalAIRuntime } from "../../../shared/ai/local-ai-runtime";
import { getPtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import { getReflectionRAGRepository } from "../../../shared/ai/reflection-rag-repository";
import { getGenerationJobStore } from "../../../shared/storage/generation-job-store";
import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { getPerformanceMetrics } from "../../../shared/utils/performance-metrics";
import { GuidedQuestionSet } from "../model/guided-question-set";
import { ReflectionEntry } from "../model/reflection-entry";
import { getReflectionRepository } from "../repository/reflection-repository";

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

      // Best-effort embedding index update for future retrieval context.
      const rag = getReflectionRAGRepository();
      const ragInit = await rag.initialize();
      if (ragInit.success) {
        await rag.storeEmbedding({
          id: entry.id,
          reflectionId: entry.id,
          text: entry.content,
          metadata: {
            entryDate: entry.entryDate,
            moodTags: entry.moodTags,
            triggerTags: entry.triggerTags,
          },
        });
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
      // 1. Retrieve the reflection content
      const reflection = reflectionResult.data;
      const content = reflection.content || "";

      // 2. Perform RAG retrieval using real embedding-backed vector search
      const rag = getReflectionRAGRepository();
      const ragInit = await rag.initialize();
      let retrievalContextReflectionIds: string[] = [reflectionId];
      let retrievedTexts: string[] = [];

      if (ragInit.success) {
        const fromDate = new Date(reflection.entryDate);
        fromDate.setDate(fromDate.getDate() - contextWindowDays);
        const minContextDate = fromDate.toISOString().split("T")[0];

        const ragResult = await rag.searchByText(content, 8, 0.45);
        if (ragResult.success && ragResult.data.length > 0) {
          const boundedContext = ragResult.data
            .filter(
              (row) =>
                row.reflectionId !== reflectionId &&
                row.entryDate >= minContextDate &&
                row.entryDate <= reflection.entryDate,
            )
            .slice(0, 5);

          retrievalContextReflectionIds = [
            reflectionId,
            ...boundedContext.map((row) => row.reflectionId),
          ];
          retrievedTexts = boundedContext.map((row) => row.text);
        }
      }

      // 3. Call local AI runtime for generation
      const runtime = getLocalAIRuntime();
      const runtimeInit = await runtime.initialize();
      let generatedQuestions: string[] | null = null;

      if (runtimeInit.success) {
        await runtime.waitReady();

        await runtime.loadModel("qwen2.5-0.5b-quantized", "");

        const promptParts: string[] = [];
        promptParts.push(
          "Voce e um assistente de reflexao em Portugues do Brasil (pt-BR) com perspectiva junguiana. Gere perguntas reflexivas nao-diretivas com tom introspectivo e compassivo. Responda SOMENTE em portugues brasileiro. Nao use palavras em ingles.",
        );
        promptParts.push(`Reflexão: ${content}`);
        if (retrievedTexts.length > 0) {
          promptParts.push(
            `Contexto adicional:\n- ${retrievedTexts.join("\n- ")}`,
          );
        }

        const prompt = promptParts.join("\n\n");

        const genResult = await runtime.generateGuidedQuestions(prompt, 6);
        if (genResult.success && genResult.data.length > 0) {
          generatedQuestions = genResult.data.slice(0, 8);
        }
      }

      // 4. Validate tone and language for generated outputs
      if (generatedQuestions && generatedQuestions.length > 0) {
        for (const q of generatedQuestions) {
          const validation = this.toneGuard.validate(q);
          if (!validation.success) {
            // If any generated question fails validation, discard and fallback
            generatedQuestions = null;
            break;
          }
        }
      }

      // If generation failed or validation failed, use fallback and queue a retry
      if (!generatedQuestions) {
        const fallbackQuestions =
          this.fallbackProvider.getGuidedQuestionsFallback();

        // Create question set with fallback mode
        const qSetResult = GuidedQuestionSet.create(
          reflectionId,
          fallbackQuestions,
          "fallback_template",
          retrievalContextReflectionIds,
          runtime.getCurrentModel()?.id ?? "qwen2.5-0.5b-q4",
          "llama.rn-0.10",
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
      }

      // Persist successful generated question set
      const qSetResult = GuidedQuestionSet.create(
        reflectionId,
        generatedQuestions,
        "normal",
        retrievalContextReflectionIds,
        runtime.getCurrentModel()?.id ?? "qwen2.5-0.5b-q4",
        "llama.rn-0.10",
      );

      if (!qSetResult.success) {
        return err(qSetResult.error);
      }

      const questionSet = qSetResult.data;

      const saveResult = await this.repository.saveQuestionSet(questionSet);
      if (!saveResult.success) {
        return err(saveResult.error);
      }

      stopTiming({
        reflectionId,
        generationMode: "normal",
        retried: false,
      });

      return ok({ questionSet });
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
      const deleteResult = await this.repository.delete(reflectionId);
      if (!deleteResult.success) {
        return deleteResult;
      }

      const rag = getReflectionRAGRepository();
      const ragInit = await rag.initialize();
      if (ragInit.success) {
        await rag.deleteEmbedding(reflectionId);
      }

      return ok(void 0);
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
