/**
 * Download utilities for fetching model files.
 *
 * Handles resumable downloads with atomic file writes,
 * progress reporting, and proper cleanup on failure or cancellation.
 */

import * as FileSystem from "expo-file-system/legacy";

import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { MIN_VALID_MODEL_BYTES } from "../constants";
import type {
    DownloadedFile,
    DownloadFileOptions
} from "../types";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Clamps a progress percentage to the range [0, 100].
 */
function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Detects whether an error represents a user-initiated cancellation.
 */
function isCancelledDownloadError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return message.includes("cancel") || message.includes("abort");
}

/**
 * Removes a file if it exists, silently ignoring errors.
 */
async function removeFileIfExists(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Ensures that a directory exists, creating it (with intermediates) if needed.
 *
 * @param directoryUri - The URI of the directory to ensure.
 * @returns A Result indicating success or a STORAGE_ERROR on failure.
 */
export async function ensureDirectoryExists(
  directoryUri: string,
): Promise<Result<void>> {
  try {
    const info = await FileSystem.getInfoAsync(directoryUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directoryUri, {
        intermediates: true,
      });
    }
    return ok(void 0);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao preparar diretorio de modelos.",
        { directoryUri },
        error as Error,
      ),
    );
  }
}

/**
 * Downloads a file atomically: writes to a `.part` temporary file,
 * validates the result, then moves it to the final destination.
 *
 * On failure or cancellation the temp file is cleaned up automatically.
 *
 * @param options - Download configuration including URL, destination, and progress callback.
 * @returns A Result containing the downloaded file info or an error.
 */
export async function downloadFileAtomically(
  options: DownloadFileOptions,
): Promise<Result<DownloadedFile>> {
  const partialUri = `${options.destinationUri}.part`;
  let completed = false;

  try {
    // Clean up any stale partial file from a previous failed attempt.
    await removeFileIfExists(partialUri);

    const resumable = FileSystem.createDownloadResumable(
      options.url,
      partialUri,
      {},
      (progressEvent) => {
        if (!options.onProgress) return;

        const expectedBytes = progressEvent.totalBytesExpectedToWrite;
        if (expectedBytes <= 0) return;

        const progress =
          (progressEvent.totalBytesWritten / expectedBytes) * 100;
        options.onProgress(clampProgress(progress));
      },
    );

    // Store reference so the caller can cancel the download.
    options.resumableRef.current = resumable;
    const response = await resumable.downloadAsync();

    if (!response?.uri) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Falha ao baixar o modelo. Tente novamente.",
          { url: options.url },
        ),
      );
    }

    // Validate that the partial file has meaningful content.
    const partialInfo = await FileSystem.getInfoAsync(partialUri);
    const downloadedSize =
      "size" in partialInfo && typeof partialInfo.size === "number"
        ? partialInfo.size
        : 0;

    if (!partialInfo.exists || downloadedSize < MIN_VALID_MODEL_BYTES) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Arquivo baixado esta vazio ou corrompido.",
          {
            partialUri,
            downloadedSize,
            minExpectedBytes: MIN_VALID_MODEL_BYTES,
          },
        ),
      );
    }

    // Atomic move from temp to final destination.
    await removeFileIfExists(options.destinationUri);
    await FileSystem.moveAsync({
      from: partialUri,
      to: options.destinationUri,
    });

    options.onProgress?.(100);
    completed = true;

    return ok({
      uri: options.destinationUri,
      sizeBytes: downloadedSize,
    });
  } catch (error) {
    // Distinguish user cancellation from genuine errors.
    if (isCancelledDownloadError(error)) {
      return err(
        createError("UNKNOWN_ERROR", "Download cancelado pelo usuario."),
      );
    }

    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao baixar o modelo. Verifique sua conexao.",
        {
          url: options.url,
          destinationUri: options.destinationUri,
        },
        error as Error,
      ),
    );
  } finally {
    // Always clear the resumable reference.
    options.resumableRef.current = null;

    // Clean up the temp file if the download did not complete successfully.
    if (!completed) {
      await removeFileIfExists(partialUri).catch(() => {
        /* ignore cleanup errors */
      });
    }
  }
}
