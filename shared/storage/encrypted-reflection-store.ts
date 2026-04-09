/**
 * T009: Implement encrypted reflection storage adapter
 *
 * Provides encrypted local persistence for reflection records using MMKV.
 * All data is encrypted at rest and secured with app lock.
 */

import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { MMKV } from "react-native-mmkv";
import { createMMKV } from "react-native-mmkv";
import { Result, createError, err, ok } from "../utils/app-error";

export interface ReflectionRecord {
  id: string;
  entryDate: string; // ISO date yyyy-mm-dd
  content: string;
  moodTags?: string[];
  triggerTags?: string[];
  sourceLocale: string; // pt-BR
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface GuidedQuestionSetRecord {
  id: string;
  reflectionId: string;
  generationMode: "normal" | "fallback_template" | "retry_result";
  questions: string[];
  retrievalContextReflectionIds: string[];
  modelId: string;
  modelVersion: string;
  generatedAt: string;
}

export interface FinalReviewRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  reflectionIds: string[];
  summary: string;
  recurringPatterns: string[];
  emotionalTriggers: string[];
  nextInquiryPrompts: string[];
  generationMode: "normal" | "fallback_template" | "retry_result";
  generatedAt: string;
}

const REFLECTION_ENCRYPTION_KEY_STORAGE = "reflection_mmkv_key";

async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(REFLECTION_ENCRYPTION_KEY_STORAGE);
  if (!key) {
    const randomBytes = getRandomBytes(16);
    key = Array.from(randomBytes, (b: number) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await SecureStore.setItemAsync(REFLECTION_ENCRYPTION_KEY_STORAGE, key);
  }
  return key;
}

/**
 * Encrypted storage adapter using MMKV
 * Provides namespaced key organization for reflections, questions, and reviews
 */
export class EncryptedReflectionStore {
  private storage: MMKV;
  private reflectionPrefix = "reflection:";
  private questionPrefix = "question:";
  private reviewPrefix = "review:";
  private listKey = "reflection:list"; // Track all reflection IDs

  private constructor(storageName: string = "reflections") {
    this.storage = createMMKV({ id: storageName });
  }

  static async create(
    storageName: string = "reflections",
  ): Promise<EncryptedReflectionStore> {
    const store = new EncryptedReflectionStore(storageName);
    const key = await getOrCreateEncryptionKey();
    if (!store.storage.isEncrypted) {
      store.storage.encrypt(key);
    }
    return store;
  }

  /**
   * Save a reflection entry
   */
  async saveReflection(record: ReflectionRecord): Promise<Result<void>> {
    try {
      const key = `${this.reflectionPrefix}${record.id}`;
      this.storage.set(key, JSON.stringify(record));

      // Track in list
      const list = this.getReflectionList();
      if (!list.includes(record.id)) {
        list.push(record.id);
        this.storage.set(this.listKey, JSON.stringify(list));
      }

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to save reflection",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Retrieve a reflection by ID
   */
  async getReflection(id: string): Promise<Result<ReflectionRecord | null>> {
    try {
      const key = `${this.reflectionPrefix}${id}`;
      const data = this.storage.getString(key);
      if (!data) return ok(null);
      return ok(JSON.parse(data) as ReflectionRecord);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve reflection",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Get all reflections
   */
  async getAllReflections(): Promise<Result<ReflectionRecord[]>> {
    try {
      const list = this.getReflectionList();
      const reflections: ReflectionRecord[] = [];

      for (const id of list) {
        const result = await this.getReflection(id);
        if (result.success && result.data) {
          reflections.push(result.data);
        }
      }

      return ok(
        reflections.sort(
          (a, b) =>
            new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
        ),
      );
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve reflections",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Delete a reflection (hard delete, no recovery)
   */
  async deleteReflection(id: string): Promise<Result<void>> {
    try {
      const key = `${this.reflectionPrefix}${id}`;
      this.storage.remove(key);

      // Remove from tracking list
      const list = this.getReflectionList();
      const index = list.indexOf(id);
      if (index > -1) {
        list.splice(index, 1);
        this.storage.set(this.listKey, JSON.stringify(list));
      }

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to delete reflection",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Save a guided question set
   */
  async saveQuestionSet(
    record: GuidedQuestionSetRecord,
  ): Promise<Result<void>> {
    try {
      const key = `${this.questionPrefix}${record.id}`;
      this.storage.set(key, JSON.stringify(record));
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to save question set",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Retrieve question sets for a specific reflection
   */
  async getQuestionSetsByReflection(
    reflectionId: string,
  ): Promise<Result<GuidedQuestionSetRecord[]>> {
    try {
      const keys = this.storage.getAllKeys();
      const questionKeys = keys.filter((k) =>
        k.startsWith(this.questionPrefix),
      );
      const sets: GuidedQuestionSetRecord[] = [];

      for (const key of questionKeys) {
        const data = this.storage.getString(key);
        if (data) {
          const set = JSON.parse(data) as GuidedQuestionSetRecord;
          if (set.reflectionId === reflectionId) {
            sets.push(set);
          }
        }
      }

      return ok(sets);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve question sets",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Delete a question set (cascade from reflection)
   */
  async deleteQuestionSet(id: string): Promise<Result<void>> {
    try {
      const key = `${this.questionPrefix}${id}`;
      this.storage.remove(key);
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to delete question set",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Save a final review
   */
  async saveFinalReview(record: FinalReviewRecord): Promise<Result<void>> {
    try {
      const key = `${this.reviewPrefix}${record.id}`;
      this.storage.set(key, JSON.stringify(record));
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to save final review",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Retrieve final reviews in a date range
   */
  async getFinalReviewsByPeriod(
    periodStart: string,
    periodEnd: string,
  ): Promise<Result<FinalReviewRecord[]>> {
    try {
      const keys = this.storage.getAllKeys();
      const reviewKeys = keys.filter((k) => k.startsWith(this.reviewPrefix));
      const reviews: FinalReviewRecord[] = [];

      for (const key of reviewKeys) {
        const data = this.storage.getString(key);
        if (data) {
          const review = JSON.parse(data) as FinalReviewRecord;
          // Check if review period overlaps with requested range
          if (
            review.periodEnd >= periodStart &&
            review.periodStart <= periodEnd
          ) {
            reviews.push(review);
          }
        }
      }

      return ok(reviews);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve reviews",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Delete a final review (cascade from reflection)
   */
  async deleteFinalReview(id: string): Promise<Result<void>> {
    try {
      const key = `${this.reviewPrefix}${id}`;
      this.storage.remove(key);
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to delete final review",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Helper: Get list of all reflection IDs
   */
  private getReflectionList(): string[] {
    try {
      const data = this.storage.getString(this.listKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all data (for testing/factory reset)
   */
  async clear(): Promise<Result<void>> {
    try {
      this.storage.clearAll();
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to clear storage",
          {},
          error as Error,
        ),
      );
    }
  }
}

// Singleton instance
let instance: EncryptedReflectionStore | null = null;

export const initReflectionStore =
  async (): Promise<EncryptedReflectionStore> => {
    if (instance) return instance;
    instance = await EncryptedReflectionStore.create("reflection_encrypted");
    return instance;
  };

export const getReflectionStore = (): EncryptedReflectionStore => {
  if (!instance) {
    throw new Error(
      "EncryptedReflectionStore not initialized. Call initReflectionStore() first.",
    );
  }
  return instance;
};
