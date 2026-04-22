/**
 * Task types supported by the model management system.
 */
export type TaskType =
  | "transcription"
  | "text-generation"
  | "voice-activity-detection"
  | "text-to-speech";

/**
 * Model file format types, used to route operations to the correct runtime.
 */
export type ModelType = "gguf" | "bin" | "vad";

/**
 * Current state of a model in the system.
 */
export type ModelStatus = {
  status:
    | "not-downloaded"
    | "downloading"
    | "downloaded"
    | "loading"
    | "loaded"
    | "failed";
  /** Download progress 0-100; 0 for non-downloading states */
  progress: number;
  error?: string;
  /** True when estimatedRamBytes exceeds available device RAM */
  isLowRam: boolean;
};

/**
 * Discriminated union for operation results — avoids throwing for expected failures.
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

/**
 * Structured error with a machine-readable code, user-friendly message,
 * optional debug context, and optional original cause.
 */
export interface AppError {
  code: ErrorCode;
  /** User-facing message */
  message: string;
  /** Additional debug context */
  context?: Record<string, unknown>;
  /** Original underlying error, if any */
  cause?: Error;
}

/**
 * All error codes produced by the model management system.
 */
export type ErrorCode =
  | "MODEL_NOT_FOUND"
  | "MODEL_NOT_DOWNLOADED"
  | "MODEL_NOT_LOADED"
  | "INVALID_TASK_TYPE"
  | "INVALID_DEFAULT"
  | "DOWNLOAD_FAILED"
  | "FILE_NOT_FOUND"
  | "CORRUPTION_DETECTED"
  | "INSUFFICIENT_STORAGE"
  | "PERMISSION_DENIED"
  | "LOAD_FAILED"
  | "UNLOAD_FAILED"
  | "RUNTIME_NOT_AVAILABLE"
  | "OPERATION_IN_PROGRESS"
  | "DOWNLOAD_ALREADY_ACTIVE";
