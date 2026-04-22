import type { AppError, ErrorCode } from "./types";

// ---------------------------------------------------------------------------
// Generic factory
// ---------------------------------------------------------------------------

/**
 * Creates an AppError with the given code, message, and optional extras.
 */
export function createError(
  code: ErrorCode,
  message: string,
  options?: { context?: Record<string, unknown>; cause?: Error },
): AppError {
  return {
    code,
    message,
    ...(options?.context !== undefined && { context: options.context }),
    ...(options?.cause !== undefined && { cause: options.cause }),
  };
}

// ---------------------------------------------------------------------------
// Validation error factories
// ---------------------------------------------------------------------------

export function createModelNotFoundError(modelId: string): AppError {
  return createError(
    "MODEL_NOT_FOUND",
    `Model "${modelId}" was not found in the catalog.`,
    { context: { modelId } },
  );
}

export function createModelNotDownloadedError(modelId: string): AppError {
  return createError(
    "MODEL_NOT_DOWNLOADED",
    `Model "${modelId}" has not been downloaded yet.`,
    { context: { modelId } },
  );
}

export function createModelNotLoadedError(modelId: string): AppError {
  return createError(
    "MODEL_NOT_LOADED",
    `Model "${modelId}" is not currently loaded.`,
    { context: { modelId } },
  );
}

export function createInvalidTaskTypeError(taskType: string): AppError {
  return createError(
    "INVALID_TASK_TYPE",
    `"${taskType}" is not a recognised task type.`,
    { context: { taskType } },
  );
}

export function createInvalidDefaultError(
  modelId: string,
  reason: string,
): AppError {
  return createError(
    "INVALID_DEFAULT",
    `Cannot set "${modelId}" as default: ${reason}`,
    { context: { modelId, reason } },
  );
}

// ---------------------------------------------------------------------------
// Storage / network error factories
// ---------------------------------------------------------------------------

export function createDownloadFailedError(
  modelId: string,
  cause?: Error,
): AppError {
  return createError(
    "DOWNLOAD_FAILED",
    `Failed to download model "${modelId}". Please check your connection and try again.`,
    { context: { modelId }, cause },
  );
}

export function createFileNotFoundError(
  modelId: string,
  path?: string,
): AppError {
  return createError(
    "FILE_NOT_FOUND",
    `Model file for "${modelId}" could not be found on disk.`,
    { context: { modelId, ...(path !== undefined && { path }) } },
  );
}

export function createCorruptionDetectedError(
  modelId: string,
  cause?: Error,
): AppError {
  return createError(
    "CORRUPTION_DETECTED",
    `Model file for "${modelId}" appears to be corrupted. Please re-download it.`,
    { context: { modelId }, cause },
  );
}

export function createInsufficientStorageError(
  modelId: string,
  requiredBytes: number,
): AppError {
  return createError(
    "INSUFFICIENT_STORAGE",
    `Not enough storage to download "${modelId}". Free up space and try again.`,
    { context: { modelId, requiredBytes } },
  );
}

export function createPermissionDeniedError(
  modelId: string,
  cause?: Error,
): AppError {
  return createError(
    "PERMISSION_DENIED",
    `Permission denied while accessing files for model "${modelId}".`,
    { context: { modelId }, cause },
  );
}

// ---------------------------------------------------------------------------
// Runtime error factories
// ---------------------------------------------------------------------------

export function createLoadFailedError(
  modelId: string,
  cause?: Error,
): AppError {
  return createError(
    "LOAD_FAILED",
    `Failed to load model "${modelId}" into memory.`,
    { context: { modelId }, cause },
  );
}

export function createUnloadFailedError(
  modelId: string,
  cause?: Error,
): AppError {
  return createError("UNLOAD_FAILED", `Failed to unload model "${modelId}".`, {
    context: { modelId },
    cause,
  });
}

export function createRuntimeNotAvailableError(runtime: string): AppError {
  return createError(
    "RUNTIME_NOT_AVAILABLE",
    `The "${runtime}" runtime is not available.`,
    { context: { runtime } },
  );
}

// ---------------------------------------------------------------------------
// Concurrency error factories
// ---------------------------------------------------------------------------

export function createOperationInProgressError(
  operation: string,
  modelId: string,
): AppError {
  return createError(
    "OPERATION_IN_PROGRESS",
    `A "${operation}" operation is already in progress for "${modelId}".`,
    { context: { operation, modelId } },
  );
}

export function createDownloadAlreadyActiveError(modelId: string): AppError {
  return createError(
    "DOWNLOAD_ALREADY_ACTIVE",
    `A download is already active for model "${modelId}".`,
    { context: { modelId } },
  );
}
