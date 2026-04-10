/**
 * T006: AI-specific error system
 *
 * Provides specialized error codes and factory functions for the AI module.
 * Maintains compatibility with AppErrorCode from shared/utils/app-error.ts
 */

import {
    createError,
    err,
    type AppError,
    type Result
} from "@/shared/utils/app-error";

// ============================================================================
// AI-Specific Error Subtypes (descriptive labels, not AppErrorCode replacements)
// ============================================================================

export type AIErrorSubtype =
  | "MODEL_NOT_FOUND"
  | "DOWNLOAD_FAILED"
  | "INSUFFICIENT_RAM"
  | "INSUFFICIENT_DISK"
  | "CONTEXT_OVERFLOW"
  | "GENERATION_TIMEOUT"
  | "MODEL_LOAD_FAILED"
  | "RUNTIME_NOT_INITIALIZED"
  | "MODEL_FILE_CORRUPTED"
  | "DOWNLOAD_CANCELLED"
  | "CATALOG_ENTRY_NOT_FOUND";

// ============================================================================
// AI Error Interface (extends AppError with optional subtype)
// ============================================================================

export interface AIError extends AppError {
  subtype?: AIErrorSubtype;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createModelNotFoundError(
  modelId: string,
  message = `Modelo "${modelId}" não encontrado.`,
): AIError {
  return createError("NOT_FOUND", message, { modelId }) as AIError;
}

export function createDownloadError(
  message: string,
  details?: Record<string, unknown>,
  cause?: Error,
): AIError {
  return createError("STORAGE_ERROR", message, details, cause) as AIError;
}

export function createInsufficientRamError(
  requiredMB: number,
  availableMB: number,
): AIError {
  return createError(
    "VALIDATION_ERROR",
    `RAM insuficiente: ${availableMB}MB disponível, ${requiredMB}MB necessário.`,
    { requiredRamMB: requiredMB, availableRamMB: availableMB },
  ) as AIError;
}

export function createInsufficientDiskError(
  requiredMB: number,
  availableMB: number,
): AIError {
  return createError(
    "STORAGE_ERROR",
    `Espaço em disco insuficiente: ${availableMB}MB disponível, ${requiredMB}MB necessário.`,
    { requiredDiskMB: requiredMB, availableDiskMB: availableMB },
  ) as AIError;
}

export function createContextOverflowError(
  messageCount: number,
  maxTokens: number,
): AIError {
  return createError(
    "VALIDATION_ERROR",
    `Contexto excedeu limite máximo de ${maxTokens} tokens (${messageCount} mensagens).`,
    { messageCount, maxTokens },
  ) as AIError;
}

export function createGenerationTimeoutError(timeoutMs: number): AIError {
  return createError(
    "LOCAL_GENERATION_UNAVAILABLE",
    `Geração excedeu tempo limite de ${timeoutMs / 1000}s.`,
    { timeoutMs },
  ) as AIError;
}

export function createModelLoadFailedError(
  modelId: string,
  cause?: Error,
): AIError {
  return createError(
    "NOT_READY",
    `Falha ao carregar modelo "${modelId}".`,
    { modelId },
    cause,
  ) as AIError;
}

export function createRuntimeNotInitializedError(): AIError {
  return createError(
    "NOT_READY",
    "Runtime de IA não inicializado. Chame initialize() antes de usar.",
  ) as AIError;
}

export function createModelFileCorruptedError(
  modelPath: string,
  expectedSize?: number,
): AIError {
  return createError(
    "VALIDATION_ERROR",
    `Arquivo do modelo corrompido: ${modelPath}`,
    { modelPath, expectedSize },
  ) as AIError;
}

export function createDownloadCancelledError(): AIError {
  return createError(
    "UNKNOWN_ERROR",
    "Download cancelado pelo usuário.",
  ) as AIError;
}

export function createCatalogEntryNotFoundError(modelId: string): AIError {
  return createError(
    "NOT_FOUND",
    `Modelo "${modelId}" não encontrado no catálogo.`,
    { modelId },
  ) as AIError;
}

// ============================================================================
// Result Helpers
// ============================================================================

export function errAI<T>(error: AIError): Result<T> {
  return err(error);
}
