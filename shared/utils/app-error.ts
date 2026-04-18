/**
 * T007: Define shared error/result types
 *
 * Provides standardized error handling across the application.
 * Used by all services and view models to return consistent errors.
 */

export type AppErrorCode =
  | "NOT_READY"
  | "EMPTY"
  | "INSUFFICIENT_MEMORY"
  | "GENERATION_FAILED"
  | "VALIDATION_ERROR"
  | "LOCAL_GENERATION_UNAVAILABLE"
  | "RETRY_QUEUE_ERROR"
  | "SECURITY_LOCK_REQUIRED"
  | "NOT_FOUND"
  | "STORAGE_ERROR"
  | "UNKNOWN_ERROR"
  | "ABORTED";

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

/**
 * Utility to create a successful result
 */
export const ok = <T>(data: T): Result<T> => ({
  success: true,
  data,
});

/**
 * Utility to create a failed result
 */
export const err = <T>(error: AppError): Result<T> => ({
  success: false,
  error,
});

/**
 * Utility to create an AppError
 */
export const createError = (
  code: AppErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error,
): AppError => ({
  code,
  message,
  details,
  cause,
});

/**
 * Type guard to check if result is successful
 */
export const isSuccess = <T>(
  result: Result<T>,
): result is { success: true; data: T } => {
  return result.success;
};

/**
 * Type guard to check if result failed
 */
export const isFailed = <T>(
  result: Result<T>,
): result is { success: false; error: AppError } => {
  return !result.success;
};

/**
 * Extract data from result or throw error
 */
export const unwrapOrThrow = <T>(result: Result<T>): T => {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(`${result.error.code}: ${result.error.message}`);
};
