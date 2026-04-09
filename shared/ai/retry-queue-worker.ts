/**
 * T015: Implement queued retry worker
 *
 * Processes pending generation jobs from the queue, retrying failed operations
 * with exponential backoff and status notification.
 */

import { GuidedQuestionSet } from "../../features/reflection/model/guided-question-set";
import { getReflectionRepository } from "../../features/reflection/repository/reflection-repository";
import { getReviewRepository } from "../../features/review/repository/review-repository";
import {
    GenerationJob,
    getGenerationJobStore,
} from "../storage/generation-job-store";
import { Result, createError, err, ok } from "../utils/app-error";
import { getLocalAIRuntime } from "./local-ai-runtime";
import { getPtBRJungianGuard } from "./ptbr-tone-guard";
import { getReflectionRAGRepository } from "./reflection-rag-repository";

export interface RetryWorkerConfig {
  pollIntervalMs: number; // How often to check for pending jobs
  maxConcurrentJobs: number;
  baseBackoffMs: number; // Initial backoff duration
  backoffMultiplier: number;
}

export type RetryStatusCallback = (job: GenerationJob) => void;

/**
 * Worker for processing queued retry jobs
 */
export class RetryQueueWorker {
  private jobStore = getGenerationJobStore();
  private reflectionRepository = getReflectionRepository();
  private reviewRepository = getReviewRepository();
  private runtime = getLocalAIRuntime();
  private ragRepository = getReflectionRAGRepository();
  private toneGuard = getPtBRJungianGuard();

  private config: RetryWorkerConfig;
  private isRunning = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private statusCallbacks: RetryStatusCallback[] = [];
  private activeJobCount = 0;

  constructor(config: Partial<RetryWorkerConfig> = {}) {
    this.config = {
      pollIntervalMs: 60000, // 1 minute default
      maxConcurrentJobs: 2,
      baseBackoffMs: 5000, // 5 seconds
      backoffMultiplier: 2,
      ...config,
    };
  }

  /**
   * Start the retry worker
   */
  async start(): Promise<Result<void>> {
    try {
      if (this.isRunning) {
        return ok(void 0);
      }

      this.isRunning = true;

      // Start polling for jobs
      this.pollTimer = setInterval(
        () => this.processQueue(),
        this.config.pollIntervalMs,
      );

      // Process immediately on start
      await this.processQueue();

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "RETRY_QUEUE_ERROR",
          "Failed to start retry worker",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Stop the retry worker
   */
  async stop(): Promise<Result<void>> {
    try {
      this.isRunning = false;
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "RETRY_QUEUE_ERROR",
          "Failed to stop retry worker",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Register callback for job status updates
   */
  onStatusChange(callback: RetryStatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Process pending jobs from the queue
   */
  private async processQueue(): Promise<void> {
    if (this.activeJobCount >= this.config.maxConcurrentJobs) {
      return;
    }

    const jobsResult = await this.jobStore.getQueuedJobs();
    if (!jobsResult.success) {
      console.warn("Failed to get queued jobs:", jobsResult.error);
      return;
    }

    for (const job of jobsResult.data) {
      if (this.activeJobCount >= this.config.maxConcurrentJobs) {
        break;
      }

      // Skip if already being processed
      if (job.status === "running") {
        continue;
      }

      if (job.status === "queued") {
        this.processJob(job);
      }
    }
  }

  /**
   * Process a single job with retry logic
   */
  private async processJob(job: GenerationJob): Promise<void> {
    try {
      this.activeJobCount++;
      const nextAttempt = job.attempts + 1;

      // Mark as running
      await this.jobStore.updateJob(job.id, {
        status: "running",
        attempts: nextAttempt,
      });

      this.notifyStatusChange(job);

      const executionResult = await this.executeGenerationJob(job);
      if (executionResult.success) {
        await this.jobStore.updateJob(job.id, {
          status: "succeeded",
        });
        this.notifyStatusChange({ ...job, status: "succeeded" });
      } else {
        // Schedule retry if attempts remaining
        if (nextAttempt < job.maxAttempts) {
          const backoffMs = this.calculateBackoff(nextAttempt - 1);

          await this.jobStore.updateJob(job.id, {
            status: "queued",
            lastError: `${executionResult.error.message}. Retry in ~${backoffMs}ms.`,
          });

          this.notifyStatusChange({ ...job, status: "queued" });
        } else {
          await this.jobStore.updateJob(job.id, {
            status: "failed",
            lastError: `${executionResult.error.message}. Max retries exceeded.`,
          });
          this.notifyStatusChange({ ...job, status: "failed" });
        }
      }
    } catch (error) {
      console.error("Error processing job:", error);
      await this.jobStore.updateJob(job.id, {
        status: "failed",
        lastError: (error as Error).message,
      });
    } finally {
      this.activeJobCount--;
    }
  }

  private async executeGenerationJob(
    job: GenerationJob,
  ): Promise<Result<void>> {
    if (job.targetType === "guided_questions") {
      return this.retryGuidedQuestions(job.targetRefId);
    }

    if (job.targetType === "final_review") {
      return this.retryFinalReview(job.targetRefId);
    }

    return err(
      createError(
        "RETRY_QUEUE_ERROR",
        `Unsupported target type: ${job.targetType}`,
      ),
    );
  }

  private async retryGuidedQuestions(
    reflectionId: string,
  ): Promise<Result<void>> {
    const reflectionResult =
      await this.reflectionRepository.getById(reflectionId);
    if (!reflectionResult.success) {
      return err(reflectionResult.error);
    }

    if (!reflectionResult.data) {
      return err(
        createError("NOT_FOUND", `Reflection ${reflectionId} not found`),
      );
    }

    const reflection = reflectionResult.data;
    const ragInit = await this.ragRepository.initialize();
    let retrievalContextIds: string[] = [reflectionId];
    let retrievedTexts: string[] = [];

    if (ragInit.success) {
      const ragResult = await this.ragRepository.searchByText(
        reflection.content,
        6,
        0.45,
      );
      if (ragResult.success) {
        const contextRows = ragResult.data
          .filter((row) => row.reflectionId !== reflectionId)
          .slice(0, 5);
        retrievalContextIds = [
          reflectionId,
          ...contextRows.map((row) => row.reflectionId),
        ];
        retrievedTexts = contextRows.map((row) => row.text);
      }
    }

    const runtimeInit = await this.runtime.initialize();
    if (!runtimeInit.success) {
      return err(runtimeInit.error);
    }

    await this.runtime.waitReady();
    const modelLoadResult = await this.runtime.loadModel(
      "qwen2.5-0.5b-quantized",
      "",
    );
    if (!modelLoadResult.success) {
      return err(modelLoadResult.error);
    }

    const promptParts = [
      "Voce e um assistente de reflexao em Portugues (pt-BR), com tom introspectivo e junguiano.",
      `Reflexao: ${reflection.content}`,
    ];

    if (retrievedTexts.length > 0) {
      promptParts.push(
        `Contexto relacionado:\n- ${retrievedTexts.join("\n- ")}`,
      );
    }

    const generationResult = await this.runtime.generateGuidedQuestions(
      promptParts.join("\n\n"),
      6,
    );
    if (!generationResult.success) {
      return err(generationResult.error);
    }

    const validatedQuestions: string[] = [];
    for (const question of generationResult.data) {
      const validation = this.toneGuard.validate(question);
      if (!validation.success) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Generated guided question did not pass language/tone validation",
            { question },
          ),
        );
      }
      validatedQuestions.push(question);
    }

    const questionSetResult = GuidedQuestionSet.create(
      reflectionId,
      validatedQuestions.slice(0, 8),
      "retry_result",
      retrievalContextIds,
      this.runtime.getCurrentModel()?.id ?? "qwen2.5-0.5b-q4",
      "llama.rn-0.10",
    );
    if (!questionSetResult.success) {
      return err(questionSetResult.error);
    }

    const saveResult = await this.reflectionRepository.saveQuestionSet(
      questionSetResult.data,
    );
    if (!saveResult.success) {
      return err(saveResult.error);
    }

    return ok(void 0);
  }

  private async retryFinalReview(reviewId: string): Promise<Result<void>> {
    const reviewResult = await this.reviewRepository.getById(reviewId);
    if (!reviewResult.success) {
      return err(reviewResult.error);
    }

    if (!reviewResult.data) {
      return err(createError("NOT_FOUND", `Review ${reviewId} not found`));
    }

    const review = reviewResult.data;
    const reflectionContents: string[] = [];

    for (const reflectionId of review.reflectionIds) {
      const reflectionResult =
        await this.reflectionRepository.getById(reflectionId);
      if (reflectionResult.success && reflectionResult.data?.content) {
        reflectionContents.push(reflectionResult.data.content.trim());
      }
    }

    if (reflectionContents.length === 0) {
      return err(
        createError(
          "NOT_FOUND",
          "No reflection content available to retry final review generation",
          { reviewId },
        ),
      );
    }

    const runtimeInit = await this.runtime.initialize();
    if (!runtimeInit.success) {
      return err(runtimeInit.error);
    }

    await this.runtime.waitReady();
    const modelLoadResult = await this.runtime.loadModel(
      "qwen2.5-0.5b-quantized",
      "",
    );
    if (!modelLoadResult.success) {
      return err(modelLoadResult.error);
    }

    const completionResult = await this.runtime.generateCompletion([
      {
        role: "system",
        content:
          "Voce sintetiza reflexoes em portugues do Brasil com tom junguiano, acolhedor e nao diretivo.",
      },
      {
        role: "user",
        content: this.buildReviewPrompt(
          review.periodStart,
          review.periodEnd,
          reflectionContents,
        ),
      },
    ]);
    if (!completionResult.success) {
      return err(completionResult.error);
    }

    const parsed = this.parseReviewOutput(completionResult.data.text);
    if (!parsed) {
      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Unable to parse final review generation output",
        ),
      );
    }

    const toneValidation = this.toneGuard.validate(parsed.summary);
    if (!toneValidation.success) {
      return err(toneValidation.error);
    }

    const saveResult = await this.reviewRepository.save({
      ...review,
      summary: parsed.summary,
      recurringPatterns: parsed.patterns,
      emotionalTriggers: parsed.triggers,
      nextInquiryPrompts: parsed.prompts,
      generationMode: "retry_result",
      modelId: this.runtime.getCurrentModel()?.id ?? review.modelId,
      modelVersion: "llama.rn-0.10",
      updatedAt: new Date().toISOString(),
    });

    if (!saveResult.success) {
      return err(saveResult.error);
    }

    return ok(void 0);
  }

  private buildReviewPrompt(
    periodStart: string,
    periodEnd: string,
    reflectionContents: string[],
  ): string {
    const numberedReflections = reflectionContents
      .map((content, index) => {
        const compact = content.replace(/\s+/g, " ").trim();
        return `${index + 1}. ${compact.slice(0, 900)}`;
      })
      .join("\n");

    return [
      `Periodo: ${periodStart} ate ${periodEnd}`,
      "Tarefa: sintetizar padroes recorrentes, gatilhos emocionais e proximas investigacoes.",
      "Regras:",
      "- Responder somente em pt-BR.",
      "- Nao inventar fatos alem das reflexoes fornecidas.",
      "- Manter tom introspectivo, acolhedor e nao-diretivo.",
      "Formato obrigatorio:",
      "RESUMO:",
      "texto",
      "PADROES:",
      "- item",
      "GATILHOS:",
      "- item",
      "PROMPTS:",
      "- pergunta?",
      "Reflexoes:",
      numberedReflections,
    ].join("\n");
  }

  private parseReviewOutput(text: string): {
    summary: string;
    patterns: string[];
    triggers: string[];
    prompts: string[];
  } | null {
    const normalized = text.replace(/\r/g, "");
    const summary = this.extractSection(normalized, "RESUMO:", "PADROES:");
    const patterns = this.parseBulletList(
      this.extractSection(normalized, "PADROES:", "GATILHOS:"),
    );
    const triggers = this.parseBulletList(
      this.extractSection(normalized, "GATILHOS:", "PROMPTS:"),
    );
    const prompts = this.parseBulletList(
      this.extractSection(normalized, "PROMPTS:"),
    ).map((item) => (item.endsWith("?") ? item : `${item}?`));

    if (!summary || prompts.length === 0) {
      return null;
    }

    return {
      summary,
      patterns,
      triggers,
      prompts,
    };
  }

  private extractSection(
    text: string,
    startMarker: string,
    endMarker?: string,
  ): string {
    const start = text.indexOf(startMarker);
    if (start < 0) {
      return "";
    }

    const startIndex = start + startMarker.length;
    const endIndex = endMarker ? text.indexOf(endMarker, startIndex) : -1;
    const section =
      endIndex >= 0 ? text.slice(startIndex, endIndex) : text.slice(startIndex);

    return section.trim();
  }

  private parseBulletList(section: string): string[] {
    return section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^(\d+[).:-]|[-*])\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Calculate exponential backoff duration
   */
  private calculateBackoff(attempts: number): number {
    return (
      this.config.baseBackoffMs *
      Math.pow(this.config.backoffMultiplier, attempts)
    );
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusChange(job: GenerationJob): void {
    for (const callback of this.statusCallbacks) {
      try {
        callback(job);
      } catch (error) {
        console.warn("Status callback error:", error);
      }
    }
  }

  /**
   * Check if worker is active
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let workerInstance: RetryQueueWorker;

export const getRetryQueueWorker = (): RetryQueueWorker => {
  if (!workerInstance) {
    workerInstance = new RetryQueueWorker();
  }
  return workerInstance;
};
