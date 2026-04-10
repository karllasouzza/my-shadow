/**
 * Storage layer for model configuration using MMKV.
 *
 * Handles persistence of active model selection and downloaded model paths
 * with Zod validation for data integrity.
 */

import { type MMKV, createMMKV } from "react-native-mmkv";
import { z } from "zod";
import { ACTIVE_MODEL_KEY, DOWNLOADED_MODELS_KEY } from "../constants";
import type { DownloadedModelMap } from "../types";

/** Zod schema for validating the downloaded model map from storage. */
const DownloadedModelMapSchema = z.record(z.string(), z.string());

let mmkvInstance: MMKV | null = null;

/** Lazily initializes and returns the MMKV storage instance. */
function getMMKV(): MMKV {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: "model_config" });
  }

  return mmkvInstance;
}

/**
 * Parses and validates a raw JSON string into a DownloadedModelMap.
 *
 * Uses Zod schema validation to ensure data integrity. Returns an empty
 * object if the raw value is undefined, invalid JSON, or fails validation.
 */
function parseMap(rawValue: string | undefined): DownloadedModelMap {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    const result = DownloadedModelMapSchema.safeParse(parsed);

    if (!result.success) {
      return {};
    }

    return result.data;
  } catch {
    return {};
  }
}

/**
 * Serializes and writes a DownloadedModelMap to MMKV storage.
 */
function writeMap(map: DownloadedModelMap): void {
  const store = getMMKV();
  store.set(DOWNLOADED_MODELS_KEY, JSON.stringify(map));
}

/**
 * Stores the active model ID in persistent storage.
 */
export function setActiveModelId(modelId: string): void {
  const store = getMMKV();
  store.set(ACTIVE_MODEL_KEY, modelId);
}

/**
 * Removes the active model ID from persistent storage.
 */
export function clearActiveModelId(): void {
  const store = getMMKV();
  store.remove(ACTIVE_MODEL_KEY);
}

/**
 * Retrieves the active model ID from persistent storage.
 *
 * Returns null if no active model is set.
 */
export function getActiveModelId(): string | null {
  const store = getMMKV();
  return store.getString(ACTIVE_MODEL_KEY) ?? null;
}

/**
 * Retrieves and validates the downloaded model map from persistent storage.
 *
 * Returns a validated map of model IDs to their local file paths.
 * Returns an empty map if no data exists or validation fails.
 */
export function getDownloadedModelMap(): DownloadedModelMap {
  const store = getMMKV();
  const raw = store.getString(DOWNLOADED_MODELS_KEY);
  return parseMap(raw);
}

/**
 * Replaces the entire downloaded model map in persistent storage.
 */
export function replaceDownloadedModelMap(map: DownloadedModelMap): void {
  writeMap(map);
}

/**
 * Updates or adds a model path entry in the downloaded model map.
 */
export function setDownloadedModelPath(
  modelId: string,
  localPath: string,
): void {
  const map = getDownloadedModelMap();
  map[modelId] = localPath;
  writeMap(map);
}

/**
 * Removes a model entry from the downloaded model map.
 *
 * No-op if the key does not exist.
 */
export function removeDownloadedModelKey(key: string): void {
  const map = getDownloadedModelMap();
  if (key in map) {
    delete map[key];
    writeMap(map);
  }
}
