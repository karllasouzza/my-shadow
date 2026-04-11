/**
 * Shared AI Types
 *
 * Tipos simplificados para uso com @react-native-ai/llama
 */

// ============================================================================
// Model Status Types
// ============================================================================

export type ModelStatus =
  | "not-downloaded"
  | "downloading"
  | "downloaded"
  | "loading"
  | "loaded"
  | "failed";

// ============================================================================
// Catalog Types
// ============================================================================

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  /** HuggingFace model ID no formato: "owner/repo/file.gguf" */
  huggingFaceId: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
  params: string;
  tags: string[];
}

// ============================================================================
// Runtime Types
// ============================================================================

export interface LoadedModel {
  id: string;
  isLoaded: boolean;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export interface CompletionOutput {
  text: string;
}

export type OnTokenCallback = (token: string) => void;

export interface StreamCompletionOptions {
  onToken?: OnTokenCallback;
  abortSignal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ============================================================================
// Manager Types
// ============================================================================

export interface DownloadProgress {
  modelId: string;
  progress: number; // 0-100
}

export interface DownloadState {
  modelId: string | null;
  progress: number;
  isActive: boolean;
}
