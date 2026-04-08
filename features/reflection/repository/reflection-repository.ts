/**
 * T025: Reflection repository adapter
 * 
 * Provides persistence layer for reflection operations using EncryptedReflectionStore.
 */

import {
  getReflectionStore,
  ReflectionRecord,
  GuidedQuestionSetRecord,
} from "../../../shared/storage/encrypted-reflection-store";
import { Result, ok, err, createError } from "../../../shared/utils/app-error";
import { ReflectionEntry } from "../model/reflection-entry";
import { GuidedQuestionSet, GuidedQuestionSetData } from "../model/guided-question-set";

export class ReflectionRepository {
  private store = getReflectionStore();

  /**
   * Save a reflection entry
   */
  async save(entry: ReflectionEntry): Promise<Result<void>> {
    try {
      return await this.store.saveReflection(entry.toData() as ReflectionRecord);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to save reflection", {}, error as Error)
      );
    }
  }

  /**
   * Get a reflection by ID
   */
  async getById(id: string): Promise<Result<ReflectionEntry | null>> {
    try {
      const result = await this.store.getReflection(id);
      if (!result.success) return result;
      if (!result.data) return ok(null);

      const entry = new ReflectionEntry(result.data);
      return ok(entry);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to retrieve reflection", {}, error as Error)
      );
    }
  }

  /**
   * Get all reflections, sorted by date descending
   */
  async getAll(): Promise<Result<ReflectionEntry[]>> {
    try {
      const result = await this.store.getAllReflections();
      if (!result.success) return result;

      const entries = result.data.map(data => new ReflectionEntry(data));
      return ok(entries);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to retrieve reflections", {}, error as Error)
      );
    }
  }

  /**
   * Get reflections by date range
   */
  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<Result<ReflectionEntry[]>> {
    try {
      const result = await this.store.getAllReflections();
      if (!result.success) return result;

      const filtered = result.data.filter(
        data => data.entryDate >= startDate && data.entryDate <= endDate
      );

      return ok(filtered.map(data => new ReflectionEntry(data)));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve reflections by date range",
          {},
          error as Error
        )
      );
    }
  }

  /**
   * Delete a reflection
   */
  async delete(id: string): Promise<Result<void>> {
    try {
      return await this.store.deleteReflection(id);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to delete reflection", {}, error as Error)
      );
    }
  }

  /**
   * Save a guided question set
   */
  async saveQuestionSet(qSet: GuidedQuestionSet): Promise<Result<void>> {
    try {
      return await this.store.saveQuestionSet(qSet.toData() as GuidedQuestionSetRecord);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to save question set", {}, error as Error)
      );
    }
  }

  /**
   * Get question sets for a reflection
   */
  async getQuestionSetsByReflection(
    reflectionId: string
  ): Promise<Result<GuidedQuestionSet[]>> {
    try {
      const result = await this.store.getQuestionSetsByReflection(reflectionId);
      if (!result.success) return result;

      const sets = result.data.map(data => new GuidedQuestionSet(data as GuidedQuestionSetData));
      return ok(sets);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to retrieve question sets", {}, error as Error)
      );
    }
  }

  /**
   * Delete a question set
   */
  async deleteQuestionSet(id: string): Promise<Result<void>> {
    try {
      return await this.store.deleteQuestionSet(id);
    } catch (error) {
      return err(
        createError("STORAGE_ERROR", "Failed to delete question set", {}, error as Error)
      );
    }
  }
}

// Singleton
let instance: ReflectionRepository;
export const getReflectionRepository = (): ReflectionRepository => {
  if (!instance) {
    instance = new ReflectionRepository();
  }
  return instance;
};
