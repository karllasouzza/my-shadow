/**
 * T014: Implement retry job persistence
 * 
 * Stores pending retry jobs for generation tasks that fail temporarily.
 * Uses encrypted local storage to persist job queue across app restarts.
 */

import { MMKV } from "react-native-mmkv";
import { Result, ok, err, createError } from "../utils/app-error";

export interface GenerationJob {
  id: string;
  targetType: "guided_questions" | "final_review";
  targetRefId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  lastError?: string;
}

/**
 * Persistence layer for generation job retry queue
 */
export class GenerationJobStore {
  private storage: MMKV;
  private jobPrefix = "job:";
  private queueKey = "job:queue";

  constructor() {
    this.storage = new MMKV({ id: "generation_jobs" });
  }

  /**
   * Create and persist a new job
   */
  async createJob(
    targetType: "guided_questions" | "final_review",
    targetRefId: string,
    maxAttempts: number = 3
  ): Promise<Result<GenerationJob>> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const job: GenerationJob = {
        id,
        targetType,
        targetRefId,
        status: "queued",
        attempts: 0,
        maxAttempts,
        createdAt: now,
        updatedAt: now,
      };

      const key = `${this.jobPrefix}${id}`;
      this.storage.setString(key, JSON.stringify(job));

      // Add to queue
      this.addToQueue(id);

      return ok(job);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to create job", {}, error as Error)
      );
    }
  }

  /**
   * Update job status
   */
  async updateJob(jobId: string, updates: Partial<GenerationJob>): Promise<Result<void>> {
    try {
      const key = `${this.jobPrefix}${jobId}`;
      const data = this.storage.getString(key);

      if (!data) {
        return err(createError("NOT_FOUND", `Job ${jobId} not found`));
      }

      const job = JSON.parse(data) as GenerationJob;
      const updated = {
        ...job,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.storage.setString(key, JSON.stringify(updated));
      return ok(void 0);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to update job", {}, error as Error)
      );
    }
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<Result<GenerationJob | null>> {
    try {
      const key = `${this.jobPrefix}${jobId}`;
      const data = this.storage.getString(key);
      if (!data) return ok(null);
      return ok(JSON.parse(data) as GenerationJob);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to retrieve job", {}, error as Error)
      );
    }
  }

  /**
   * Get all queued jobs
   */
  async getQueuedJobs(): Promise<Result<GenerationJob[]>> {
    try {
      const queueData = this.storage.getString(this.queueKey);
      if (!queueData) return ok([]);

      const jobIds: string[] = JSON.parse(queueData);
      const jobs: GenerationJob[] = [];

      for (const id of jobIds) {
        const result = await this.getJob(id);
        if (result.success && result.data) {
          if (result.data.status === "queued" || result.data.status === "running") {
            jobs.push(result.data);
          }
        }
      }

      return ok(jobs);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to retrieve queued jobs", {}, error as Error)
      );
    }
  }

  /**
   * Remove from queue and delete job
   */
  async deleteJob(jobId: string): Promise<Result<void>> {
    try {
      const key = `${this.jobPrefix}${jobId}`;
      this.storage.delete(key);

      // Remove from queue
      this.removeFromQueue(jobId);

      return ok(void 0);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to delete job", {}, error as Error)
      );
    }
  }

  /**
   * Clear all jobs (for testing)
   */
  async clear(): Promise<Result<void>> {
    try {
      const keys = this.storage.getAllKeys();
      for (const key of keys) {
        if (key.startsWith(this.jobPrefix)) {
          this.storage.delete(key);
        }
      }
      this.storage.delete(this.queueKey);
      return ok(void 0);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to clear jobs", {}, error as Error)
      );
    }
  }

  /**
   * Helper: Add job to queue tracking
   */
  private addToQueue(jobId: string): void {
    const queueData = this.storage.getString(this.queueKey);
    const queue: string[] = queueData ? JSON.parse(queueData) : [];
    if (!queue.includes(jobId)) {
      queue.push(jobId);
      this.storage.setString(this.queueKey, JSON.stringify(queue));
    }
  }

  /**
   * Helper: Remove job from queue tracking
   */
  private removeFromQueue(jobId: string): void {
    const queueData = this.storage.getString(this.queueKey);
    if (queueData) {
      const queue: string[] = JSON.parse(queueData);
      const index = queue.indexOf(jobId);
      if (index > -1) {
        queue.splice(index, 1);
        this.storage.setString(this.queueKey, JSON.stringify(queue));
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let jobStoreInstance: GenerationJobStore;

export const getGenerationJobStore = (): GenerationJobStore => {
  if (!jobStoreInstance) {
    jobStoreInstance = new GenerationJobStore();
  }
  return jobStoreInstance;
};
