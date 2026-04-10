/**
 * T009: Catalog helper functions
 *
 * Provides lookup and filtering utilities for the model catalog.
 */

import { getDownloadedModelMap } from "../manager/storage";
import { MODEL_CATALOG } from "./data";
import type { ModelCatalogEntry } from "./types";

/**
 * Find a model by its ID. Returns undefined if not found.
 */
export function findModelById(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}

/**
 * Get all models in the catalog.
 */
export function getAllModels(): ModelCatalogEntry[] {
  return [...MODEL_CATALOG];
}

/**
 * Filter models that fit within the available RAM.
 */
export function getModelsByRam(maxRamBytes: number): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((model) => model.estimatedRamBytes <= maxRamBytes);
}

/**
 * Check if a model has been downloaded.
 */
export async function isModelDownloaded(modelId: string): Promise<boolean> {
  const downloadedMap = getDownloadedModelMap();
  const path = downloadedMap[modelId];
  if (!path) return false;

  // Verify file still exists on disk
  const *FileSystem = await import("expo-file-system/legacy");
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}

/**
 * Get models that are NOT yet downloaded (available for download).
 */
export async function getAvailableForDownload(): Promise<
  { entry: ModelCatalogEntry; isDownloaded: boolean }[]
> {
  const downloadedMap = getDownloadedModelMap();
  return MODEL_CATALOG.map((entry) => ({
    entry,
    isDownloaded: !!downloadedMap[entry.id],
  }));
}
