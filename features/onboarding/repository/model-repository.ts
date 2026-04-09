/**
 * Onboarding: Model repository
 *
 * Manages model configuration persistence using MMKV (no encryption).
 * Singleton pattern with getRepository() accessor.
 */

import { MMKV, createMMKV } from "react-native-mmkv";
import { ModelConfiguration } from "../model/model-configuration";

const ACTIVE_MODEL_KEY = "active_model_config";
const DOWNLOADED_MODELS_KEY = "downloaded_models";

export class ModelRepository {
  private storage: MMKV;

  constructor() {
    this.storage = createMMKV({ id: "model_config" });
  }

  /**
   * Save the active model configuration
   */
  saveActiveModel(config: ModelConfiguration): void {
    this.storage.set(ACTIVE_MODEL_KEY, JSON.stringify(config));
  }

  /**
   * Get the active model configuration, or null if none set
   */
  getActiveModel(): ModelConfiguration | null {
    const raw = this.storage.getString(ACTIVE_MODEL_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ModelConfiguration;
    } catch {
      return null;
    }
  }

  /**
   * Check if a model has been downloaded (by key)
   */
  hasDownloadedModel(modelKey: string): boolean {
    const raw = this.storage.getString(DOWNLOADED_MODELS_KEY);
    if (!raw) return false;
    try {
      const downloaded: string[] = JSON.parse(raw);
      return downloaded.includes(modelKey);
    } catch {
      return false;
    }
  }

  /**
   * Mark a model as downloaded
   */
  markModelAsDownloaded(modelKey: string): void {
    const raw = this.storage.getString(DOWNLOADED_MODELS_KEY);
    let downloaded: string[] = [];
    if (raw) {
      try {
        downloaded = JSON.parse(raw);
      } catch {
        downloaded = [];
      }
    }
    if (!downloaded.includes(modelKey)) {
      downloaded.push(modelKey);
      this.storage.set(DOWNLOADED_MODELS_KEY, JSON.stringify(downloaded));
    }
  }

  /**
   * Clear the active model configuration
   */
  clearActiveModel(): void {
    this.storage.remove(ACTIVE_MODEL_KEY);
  }

  /**
   * Get all downloaded model keys
   */
  getDownloadedModelKeys(): string[] {
    const raw = this.storage.getString(DOWNLOADED_MODELS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }
}

// Singleton
let instance: ModelRepository | null = null;

export const getModelRepository = (): ModelRepository => {
  if (!instance) {
    instance = new ModelRepository();
  }
  return instance;
};
