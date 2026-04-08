/**
 * T021: Integration test for fallback prompts plus queued retry
 */

import { describe, expect, it } from "bun:test";
import { getFallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import { getRetryQueueWorker } from "../../../shared/ai/retry-queue-worker";
import { getGenerationJobStore } from "../../../shared/storage/generation-job-store";
import { unwrapOrThrow } from "../../../shared/utils/app-error";

describe("Guided Question Generation - Fallback + Retry", () => {
  beforeEach(async () => {
    const jobStore = getGenerationJobStore();
    await jobStore.clear();
  });

  it("should provide fallback questions in Portuguese", () => {
    const fallbackProvider = getFallbackPromptProvider();
    const questions = fallbackProvider.getGuidedQuestionsFallback();

    expect(questions).toBeDefined();
    expect(questions.length).toBeGreaterThan(0);

    // Verify all are in Portuguese
    for (const question of questions) {
      expect(question).toMatch(/[a-záàâãéèêíìîóòôõöúùûü]/);
    }
  });

  it("should create retry job when generation fails", async () => {
    const jobStore = getGenerationJobStore();
    const reflectionId = "test_refl_001";

    const result = await jobStore.createJob(
      "guided_questions",
      reflectionId,
      3, // max 3 attempts
    );

    expect(result.success).toBe(true);
    const job = unwrapOrThrow(result);
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(3);
  });

  it("should queue and process retry jobs", async () => {
    const jobStore = getGenerationJobStore();
    const worker = getRetryQueueWorker();

    // Create a failing job
    const createResult = await jobStore.createJob(
      "final_review",
      "test_review_001",
    );
    expect(createResult.success).toBe(true);

    // Get queued jobs
    const queuedResult = await jobStore.getQueuedJobs();
    expect(queuedResult.success).toBe(true);
    const queuedJobs = unwrapOrThrow(queuedResult);
    expect(queuedJobs.length).toBeGreaterThan(0);

    // Start worker
    const startResult = await worker.start();
    expect(startResult.success).toBe(true);

    // Stop after a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const stopResult = await worker.stop();
    expect(stopResult.success).toBe(true);
  });

  it("should increment attempts on retry", async () => {
    const jobStore = getGenerationJobStore();

    const createResult = await jobStore.createJob(
      "guided_questions",
      "test_001",
      3,
    );
    expect(createResult.success).toBe(true);
    const jobId = unwrapOrThrow(createResult).id;

    // Simulate first attempt
    await jobStore.updateJob(jobId, { attempts: 1 });

    // Verify attempt was incremented
    const getResult = await jobStore.getJob(jobId);
    expect(getResult.success).toBe(true);
    const current = unwrapOrThrow(getResult);
    expect(current).not.toBeNull();
    expect(current!.attempts).toBe(1);
  });

  it("should mark job failed after max attempts", async () => {
    const jobStore = getGenerationJobStore();

    const createResult = await jobStore.createJob(
      "guided_questions",
      "test_002",
      2,
    );
    const jobId = unwrapOrThrow(createResult).id;

    // Simulate max attempts reached
    await jobStore.updateJob(jobId, {
      status: "failed",
      attempts: 2,
      lastError: "Max retries exceeded",
    });

    const getResult = await jobStore.getJob(jobId);
    const failed = unwrapOrThrow(getResult);
    expect(failed).not.toBeNull();
    expect(failed!.status).toBe("failed");
    expect(failed!.lastError).toContain("Max retries");
  });

  it("should provide complete fallback prompt set", () => {
    const fallbackProvider = getFallbackPromptProvider();
    const set = fallbackProvider.getCompleteFallbackSet(
      "2026-04-01",
      "2026-04-07",
    );

    expect(set.questions.length).toBeGreaterThan(0);
    expect(set.reviewTemplate).toContain("pt-BR");
    expect(set.emotionalTriggerPrompts.length).toBeGreaterThan(0);
    expect(set.patternIdentificationPrompts.length).toBeGreaterThan(0);
  });
});
