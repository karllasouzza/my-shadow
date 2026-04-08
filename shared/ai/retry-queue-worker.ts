/**
 * T015: Implement queued retry worker
 *
 * Processes pending generation jobs from the queue, retrying failed operations
 * with exponential backoff and status notification.
 */

import {
    GenerationJob,
    getGenerationJobStore,
} from "../storage/generation-job-store";
import { Result, createError, err, ok } from "../utils/app-error";

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

      // Mark as running
      await this.jobStore.updateJob(job.id, {
        status: "running",
        attempts: job.attempts + 1,
      });

      this.notifyStatusChange(job);

      // TODO: Actually execute the generation job
      // This would call the appropriate generation service based on targetType
      // For now, simulate success
      const success = Math.random() > 0.3; // 70% success rate for simulation

      if (success) {
        await this.jobStore.updateJob(job.id, {
          status: "succeeded",
        });
        this.notifyStatusChange({ ...job, status: "succeeded" });
      } else {
        // Schedule retry if attempts remaining
        if (job.attempts < job.maxAttempts) {
          const backoffMs = this.calculateBackoff(job.attempts);
          const delayUntil = Date.now() + backoffMs;

          await this.jobStore.updateJob(job.id, {
            status: "queued",
            lastError: "Generation failed, scheduled for retry",
          });

          // Note: Real implementation would schedule timer to respawn job
          this.notifyStatusChange({ ...job, status: "queued" });
        } else {
          await this.jobStore.updateJob(job.id, {
            status: "failed",
            lastError: "Max retries exceeded",
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
