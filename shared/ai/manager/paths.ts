/**
 * Phase 5: Path utilities for model file management.
 *
 * Provides functions for resolving, sanitizing, and validating
 * file URIs used throughout the AI model lifecycle.
 */

import { createError, err, ok, Result } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { MODEL_FILE_EXTENSION, MODELS_SUBDIRECTORY } from "../constants";

/**
 * Ensures a path string is prefixed with `file://` URI scheme.
 *
 * If the input already starts with `file://`, it is returned unchanged.
 */
export function ensureFileUri(pathOrUri: string): string {
  if (pathOrUri.startsWith("file://")) {
    return pathOrUri;
  }

  return `file://${pathOrUri}`;
}

/**
 * Returns the URI of the models directory inside the app's document directory.
 *
 * Fails with a `STORAGE_ERROR` if the document directory is unavailable.
 */
export function getModelsDirectoryUri(): Result<string> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    return err(
      createError("STORAGE_ERROR", "Diretorio de armazenamento indisponivel."),
    );
  }

  return ok(`${documentDirectory}${MODELS_SUBDIRECTORY}/`);
}

/**
 * Sanitizes a model identifier so it is safe to use as a file name.
 *
 * Trims whitespace, lowercases, and replaces any character that is not
 * alphanumeric, hyphen, or underscore with a hyphen.
 */
export function sanitizeModelId(modelId: string): string {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-");
}

/**
 * Returns the default file name for a model based on its sanitized ID.
 *
 * Appends the unified `MODEL_FILE_EXTENSION` (e.g. `.gguf`).
 */
export function getDefaultModelFileName(modelId: string): string {
  return `${sanitizeModelId(modelId)}${MODEL_FILE_EXTENSION}`;
}

/**
 * Resolves the destination URI for a model download.
 *
 * If `customPathOrUri` is provided and non-empty, it is normalized via
 * `ensureFileUri`. Otherwise a default file name is generated from the
 * `modelId` and placed under `modelsDirectoryUri`.
 */
export function resolveModelDestinationUri(
  modelId: string,
  customPathOrUri: string | undefined,
  modelsDirectoryUri: string,
): string {
  if (customPathOrUri && customPathOrUri.trim().length > 0) {
    return ensureFileUri(customPathOrUri);
  }

  return `${modelsDirectoryUri}${getDefaultModelFileName(modelId)}`;
}

/**
 * Extracts the file name from a URL (e.g. a download link).
 *
 * Parses the URL pathname and decodes URI components. Falls back to
 * splitting on `/` for malformed URLs. Returns a default `.gguf` name
 * when no file name can be determined.
 */
export function extractFileNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathName = parsedUrl.pathname;
    const fileName = pathName.substring(pathName.lastIndexOf("/") + 1);
    if (fileName) {
      return decodeURIComponent(fileName);
    }
  } catch {
    const withoutQuery = url.split("?")[0];
    const segments = withoutQuery.split("/").filter(Boolean);
    const fileName = segments[segments.length - 1];
    if (fileName) {
      return decodeURIComponent(fileName);
    }
  }

  return `model${MODEL_FILE_EXTENSION}`;
}

/**
 * Resolves a legacy model URI by extracting the file name from a
 * download URL and appending it to the models directory URI.
 *
 * Used for backwards compatibility with older download links.
 */
export function resolveLegacyModelUri(
  downloadUrl: string,
  modelsDirectoryUri: string,
): string {
  return `${modelsDirectoryUri}${extractFileNameFromUrl(downloadUrl)}`;
}
