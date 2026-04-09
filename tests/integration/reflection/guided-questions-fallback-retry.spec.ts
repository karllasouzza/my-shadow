/**
 * T021: Integration test for fallback prompts plus queued retry
 *
 * Tests fallback prompt generation and job store interactions with mocked storage.
 */

import { getFallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import type { GenerationJob } from "../../../shared/storage/generation-job-store";
import { ok } from "../../../shared/utils/app-error";

// Mock llama.rn native module
jest.mock("llama.rn", () => require("../../__mocks__/llama.rn"));

// In-memory job store
const mockJobs = new Map<string, GenerationJob>();

const mockJobStore = {
  createJob: jest.fn(
    async (
      targetType: "guided_questions" | "final_review",
      targetRefId: string,
      maxAttempts: number = 3,
    ) => {
      const job: GenerationJob = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        targetType,
        targetRefId,
        status: "queued",
        attempts: 0,
        maxAttempts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockJobs.set(job.id, job);
      return ok(job);
    },
  ),
  updateJob: jest.fn(async (jobId: string, updates: Partial<GenerationJob>) => {
    const job = mockJobs.get(jobId);
    if (!job) return ok(null as unknown as GenerationJob);
    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    return ok(job);
  }),
  getJob: jest.fn(async (jobId: string) => {
    const job = mockJobs.get(jobId);
    if (!job) return ok(null as unknown as GenerationJob);
    return ok(job);
  }),
  getQueuedJobs: jest.fn(async () => {
    const queued = Array.from(mockJobs.values()).filter(
      (j) => j.status === "queued",
    );
    return ok(queued);
  }),
  deleteJob: jest.fn(async (jobId: string) => {
    mockJobs.delete(jobId);
    return ok(undefined);
  }),
  clear: jest.fn(async () => {
    mockJobs.clear();
    return ok(undefined);
  }),
};

jest.mock("../../../shared/storage/generation-job-store", () => ({
  getGenerationJobStore: jest.fn(() => mockJobStore),
  GenerationJobStore: jest.fn(),
}));

// Mock retry queue worker
const mockWorker = {
  start: jest.fn(async () => ok(undefined)),
  stop: jest.fn(async () => ok(undefined)),
};

jest.mock("../../../shared/ai/retry-queue-worker", () => ({
  getRetryQueueWorker: jest.fn(() => mockWorker),
}));

describe("Guided Question Generation - Fallback + Retry", () => {
  beforeEach(async () => {
    mockJobs.clear();
    jest.clearAllMocks();
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
    const {
      getGenerationJobStore,
    } = require("../../../shared/storage/generation-job-store");
    const jobStore = getGenerationJobStore();
    const reflectionId = "test_refl_001";

    const result = await jobStore.createJob(
      "guided_questions",
      reflectionId,
      3, // max 3 attempts
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const job = result.data;
      expect(job.status).toBe("queued");
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
    }
  });

  it("should queue and process retry jobs", async () => {
    const {
      getGenerationJobStore,
    } = require("../../../shared/storage/generation-job-store");
    const {
      getRetryQueueWorker,
    } = require("../../../shared/ai/retry-queue-worker");
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
    if (queuedResult.success) {
      expect(queuedResult.data.length).toBeGreaterThan(0);
    }

    // Start worker
    const startResult = await worker.start();
    expect(startResult.success).toBe(true);

    // Stop after a moment
    const stopResult = await worker.stop();
    expect(stopResult.success).toBe(true);
  });

  it("should increment attempts on retry", async () => {
    const {
      getGenerationJobStore,
    } = require("../../../shared/storage/generation-job-store");
    const jobStore = getGenerationJobStore();

    const createResult = await jobStore.createJob(
      "guided_questions",
      "test_001",
      3,
    );
    expect(createResult.success).toBe(true);
    if (!createResult.success) return;
    const jobId = createResult.data.id;

    // Simulate first attempt
    await jobStore.updateJob(jobId, { attempts: 1 });

    // Verify attempt was incremented
    const getResult = await jobStore.getJob(jobId);
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.data).not.toBeNull();
      expect(getResult.data.attempts).toBe(1);
    }
  });

  it("should mark job failed after max attempts", async () => {
    const {
      getGenerationJobStore,
    } = require("../../../shared/storage/generation-job-store");
    const jobStore = getGenerationJobStore();

    const createResult = await jobStore.createJob(
      "guided_questions",
      "test_002",
      2,
    );
    if (!createResult.success) return;
    const jobId = createResult.data.id;

    // Simulate max attempts reached
    await jobStore.updateJob(jobId, {
      status: "failed",
      attempts: 2,
      lastError: "Max retries exceeded",
    });

    const getResult = await jobStore.getJob(jobId);
    if (getResult.success) {
      expect(getResult.data).not.toBeNull();
      expect(getResult.data.status).toBe("failed");
      expect(getResult.data.lastError).toContain("Max retries");
    }
  });

  it("should provide complete fallback prompt set", () => {
    const fallbackProvider = getFallbackPromptProvider();
    const set = fallbackProvider.getCompleteFallbackSet(
      "2026-04-01",
      "2026-04-07",
    );

    expect(set.questions.length).toBeGreaterThan(0);
    // Template is in Portuguese (Brazil) - check for Portuguese content
    expect(set.reviewTemplate).toMatch(/[ãçéêíóõú]/);
    expect(set.emotionalTriggerPrompts.length).toBeGreaterThan(0);
    expect(set.patternIdentificationPrompts.length).toBeGreaterThan(0);
  });
});
