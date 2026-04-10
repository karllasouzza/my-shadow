/**
 * T005: Unified constants for shared/ai/
 *
 * Consolidates all constant values from manager/constants.ts and
 * runtime/constants.ts into a single source of truth.
 */

// ============================================================================
// Path Constants
// ============================================================================

export const MODELS_SUBDIRECTORY = "models";
export const MODEL_FILE_EXTENSION = ".gguf";

// ============================================================================
// MMKV Storage Keys
// ============================================================================

export const ACTIVE_MODEL_KEY = "model:active";
export const DOWNLOADED_MODELS_KEY = "model:downloaded";

// ============================================================================
// Model Validation Constants
// ============================================================================

export const MIN_VALID_MODEL_BYTES = 5 * 1024 * 1024; // 5MB
export const MIN_EXPECTED_SIZE_RATIO = 0.5;
export const DISK_SAFETY_BUFFER_BYTES = 100 * 1024 * 1024; // 100MB

// ============================================================================
// Runtime Constants
// ============================================================================

export const DEFAULT_CONTEXT_LENGTH = 4096;
export const RESERVED_RESPONSE_TOKENS = 512;
export const GENERATION_TIMEOUT_MS = 60_000; // 60 seconds

// ============================================================================
// Context Window Constants
// ============================================================================

export const MAX_CONTEXT_MESSAGES = 10; // 5 trocas (user + assistant)
export const EFFECTIVE_CONTEXT_TOKENS =
  DEFAULT_CONTEXT_LENGTH - RESERVED_RESPONSE_TOKENS; // 3584 tokens

// ============================================================================
// UI Constants
// ============================================================================

export const CANCEL_GENERATION_AFTER_MS = 30_000; // 30 seconds
export const MAX_MESSAGE_LENGTH = 10_000; // characters
export const AUTO_TITLE_MAX_LENGTH = 50; // characters for auto-generated title
export const LAST_MESSAGE_PREVIEW_LENGTH = 80; // characters for history preview
