/**
 * Database: Model Configuration
 *
 * Centraliza toda persistência de configuração de modelos usando MMKV.
 * Substitui shared/ai/manager/storage.ts
 *
 * Storage format:
 * - Active model ID: MMKV key `model:active` → string
 * - Downloaded models map: MMKV key `model:downloaded` → JSON Record<id, path>
 */

import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { createMMKV, type MMKV } from "react-native-mmkv";
import { z } from "zod";

// ============================================================================
// Constants
// ============================================================================

const ACTIVE_MODEL_KEY = "model:active";
const DOWNLOADED_MODELS_KEY = "model:downloaded";

// ============================================================================
// Types
// ============================================================================

export type DownloadedModelMap = Record<string, string>;

export interface ModelConfig {
  activeModelId: string | null;
  downloadedModels: DownloadedModelMap;
}

// ============================================================================
// Storage Instance
// ============================================================================

let mmkvInstance: MMKV | null = null;

function getMMKV(): MMKV {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: "model_config" });
  }
  return mmkvInstance;
}

// ============================================================================
// Active Model Operations
// ============================================================================

/** Stores the active model ID in persistent storage. */
export function setActiveModelId(modelId: string): void {
  const store = getMMKV();
  store.set(ACTIVE_MODEL_KEY, modelId);
}

/** Removes the active model ID from persistent storage. */
export function clearActiveModelId(): void {
  const store = getMMKV();
  store.remove(ACTIVE_MODEL_KEY);
}

/** Retrieves the active model ID from persistent storage. */
export function getActiveModelId(): string | null {
  const store = getMMKV();
  return store.getString(ACTIVE_MODEL_KEY) ?? null;
}

// ============================================================================
// Downloaded Models Operations
// ============================================================================

/** Zod schema for validating the downloaded model map. */
const DownloadedModelMapSchema = z.record(z.string(), z.string());

/** Parses and validates a raw JSON string into a DownloadedModelMap. */
function parseMap(rawValue: string | undefined): DownloadedModelMap {
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    const result = DownloadedModelMapSchema.safeParse(parsed);
    if (!result.success) return {};
    return result.data;
  } catch {
    return {};
  }
}

/** Serializes and writes a DownloadedModelMap to MMKV storage. */
function writeMap(map: DownloadedModelMap): void {
  const store = getMMKV();
  store.set(DOWNLOADED_MODELS_KEY, JSON.stringify(map));
}

/** Retrieves and validates the downloaded model map from persistent storage. */
export function getDownloadedModelMap(): DownloadedModelMap {
  const store = getMMKV();
  const raw = store.getString(DOWNLOADED_MODELS_KEY);
  return parseMap(raw);
}

/** Replaces the entire downloaded model map in persistent storage. */
export function replaceDownloadedModelMap(map: DownloadedModelMap): void {
  writeMap(map);
}

/** Updates or adds a model path entry in the downloaded model map. */
export function setDownloadedModelPath(
  modelId: string,
  localPath: string,
): void {
  const map = getDownloadedModelMap();
  map[modelId] = localPath;
  writeMap(map);
}

/** Removes a model entry from the downloaded model map. */
export function removeDownloadedModel(modelId: string): void {
  const map = getDownloadedModelMap();
  if (modelId in map) {
    delete map[modelId];
    writeMap(map);
  }
}

/**
 * Gets local path for a model ID.
 * Returns null if model is not downloaded.
 */
export function getModelLocalPath(modelId: string): string | null {
  const map = getDownloadedModelMap();
  return map[modelId] ?? null;
}

/** Checks if a model is downloaded. */
export function isModelDownloaded(modelId: string): boolean {
  const map = getDownloadedModelMap();
  return modelId in map;
}

/** Checks if a model is currently active. */
export function isModelActive(modelId: string): boolean {
  const activeId = getActiveModelId();
  return activeId === modelId;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/** Gets complete model configuration. */
export function getModelConfig(): ModelConfig {
  return {
    activeModelId: getActiveModelId(),
    downloadedModels: getDownloadedModelMap(),
  };
}

/** Clears all model configuration. */
export function clearModelConfig(): Result<void> {
  try {
    clearActiveModelId();
    replaceDownloadedModelMap({});
    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Failed to clear model configuration",
        {},
        error as Error,
      ),
    );
  }
}
