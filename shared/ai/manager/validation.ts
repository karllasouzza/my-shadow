/**
 * Phase 7: Validation module for AI model operations.
 *
 * Provides utilities to validate model files, check disk space,
 * and verify RAM availability before loading models.
 */
import * as FileSystem from "expo-file-system/legacy";
import DeviceInfo from "react-native-device-info";

import type { DiskSpaceCheck, ModelFileDiagnostics, RamCheck } from "../types";

import {
    DISK_SAFETY_BUFFER_BYTES,
    MIN_EXPECTED_SIZE_RATIO,
    MIN_VALID_MODEL_BYTES,
} from "../constants";

import { Result, createError, err, ok } from "@/shared/utils/app-error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an arbitrary path or file:// URI into a file:// URI.
 * If the string already starts with "file://" it is returned as-is;
 * otherwise it is resolved against the document directory.
 */
function ensureFileUri(pathOrUri: string): string {
  if (pathOrUri.startsWith("file://")) {
    return pathOrUri;
  }
  // Treat as a bare path relative to documentDirectory
  const docDir = FileSystem.documentDirectory ?? "";
  return `${docDir}${pathOrUri.startsWith("/") ? pathOrUri : `/${pathOrUri}`}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a model file exists on disk.
 */
export async function fileExists(pathOrUri: string): Promise<boolean> {
  const uri = ensureFileUri(pathOrUri);
  const info = await FileSystem.getInfoAsync(uri);
  return Boolean(info.exists);
}

/**
 * Validate that a model file exists and meets minimum size requirements.
 *
 * When `expectedSizeBytes` is provided the function also verifies that the
 * actual file size is at least `MIN_EXPECTED_SIZE_RATIO` of the expected
 * size to catch incomplete downloads.
 *
 * Returns `Result<number>` where the number is the verified file size in
 * bytes.
 */
export async function verifyModelFile(
  pathOrUri: string,
  expectedSizeBytes?: number,
): Promise<Result<number>> {
  try {
    const uri = ensureFileUri(pathOrUri);
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) {
      return err(
        createError("NOT_FOUND", "Arquivo do modelo nao encontrado.", {
          uri,
        }),
      );
    }

    const fileSize = info.size ?? 0;
    if (fileSize < MIN_VALID_MODEL_BYTES) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Arquivo do modelo esta vazio ou incompleto.",
          {
            uri,
            fileSize,
            minimumBytes: MIN_VALID_MODEL_BYTES,
          },
        ),
      );
    }

    if (expectedSizeBytes && expectedSizeBytes > 0) {
      const minimumExpected = Math.floor(
        expectedSizeBytes * MIN_EXPECTED_SIZE_RATIO,
      );
      if (fileSize < minimumExpected) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Download incompleto: arquivo menor que o esperado.",
            {
              uri,
              fileSize,
              expectedSizeBytes,
              minimumExpected,
            },
          ),
        );
      }
    }

    return ok(fileSize);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Erro ao validar arquivo do modelo.",
        {},
        error as Error,
      ),
    );
  }
}

/**
 * Verify that there is enough free disk space for a download.
 *
 * Adds `DISK_SAFETY_BUFFER_BYTES` to the required amount as a safety
 * margin.
 *
 * Returns a `DiskSpaceCheck` diagnostic object wrapped in a `Result`.
 */
export async function hasEnoughDiskSpace(
  requiredBytes: number,
): Promise<Result<DiskSpaceCheck>> {
  try {
    if (requiredBytes <= 0) {
      return ok({
        hasEnoughSpace: true,
        freeBytes: 0,
        requiredBytes: 0,
      });
    }

    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    const requiredWithBuffer = requiredBytes + DISK_SAFETY_BUFFER_BYTES;

    if (freeBytes < requiredWithBuffer) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Espaco em disco insuficiente para baixar o modelo.",
          {
            freeBytes,
            requiredBytes,
            requiredWithBuffer,
          },
        ),
      );
    }

    return ok({
      hasEnoughSpace: true,
      freeBytes,
      requiredBytes,
    });
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Nao foi possivel verificar o espaco em disco.",
        {},
        error as Error,
      ),
    );
  }
}

/**
 * Verify that the device has enough RAM to load a model.
 *
 * Compares the device total RAM against `estimatedRamBytes`.  If the
 * total RAM is less than the estimate a warning is attached but the
 * check still returns `success: true` (many models can still load with
 * reduced performance via swap).
 *
 * Returns a `RamCheck` diagnostic object wrapped in a `Result`.
 */
export async function hasEnoughRam(
  estimatedRamBytes: number,
): Promise<Result<RamCheck>> {
  try {
    if (estimatedRamBytes <= 0) {
      return ok({
        hasEnoughRam: true,
        totalRamBytes: 0,
        requiredRamBytes: 0,
        warning: null,
      });
    }

    const totalRamBytes = await DeviceInfo.getTotalMemory();
    const hasEnoughRam = totalRamBytes >= estimatedRamBytes;
    const warning = hasEnoughRam
      ? null
      : `RAM total (${(totalRamBytes / 1e9).toFixed(1)} GB) pode ser insuficiente para o modelo (estimativa ${(estimatedRamBytes / 1e9).toFixed(1)} GB).`;

    return ok({
      hasEnoughRam,
      totalRamBytes,
      requiredRamBytes: estimatedRamBytes,
      warning,
    });
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Nao foi possivel verificar a memoria RAM disponivel.",
        {},
        error as Error,
      ),
    );
  }
}

/**
 * Run a full pre-flight validation for downloading and loading a model.
 *
 * Returns an array of `ModelFileDiagnostics` describing every issue found.
 */
export async function validateModelDownload(
  pathOrUri: string,
  expectedSizeBytes: number,
  estimatedRamBytes: number,
): Promise<ModelFileDiagnostics[]> {
  const diagnostics: ModelFileDiagnostics[] = [];

  // Disk space check
  const diskResult = await hasEnoughDiskSpace(expectedSizeBytes);
  if (!diskResult.success || !diskResult.data.hasEnoughSpace) {
    diagnostics.push({
      isValid: false,
      errorMessage: diskResult.success
        ? "Espaco em disco insuficiente."
        : diskResult.error.message,
      details: diskResult.success ? { ...diskResult.data } : {},
    });
  }

  // RAM check
  const ramResult = await hasEnoughRam(estimatedRamBytes);
  if (ramResult.success && ramResult.data.warning) {
    diagnostics.push({
      isValid: false,
      errorMessage: ramResult.data.warning,
      details: { ...ramResult.data },
    });
  }

  // File validation (if already downloaded)
  const fileResult = await verifyModelFile(pathOrUri, expectedSizeBytes);
  if (!fileResult.success) {
    diagnostics.push({
      isValid: false,
      errorMessage: fileResult.error.message,
      details: fileResult.error.details ?? {},
    });
  }

  if (diagnostics.length === 0) {
    diagnostics.push({
      isValid: true,
      errorMessage: "",
      details: {},
    });
  }

  return diagnostics;
}
