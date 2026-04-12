export type ModelStatus =
  | "not-downloaded"
  | "downloading"
  | "downloaded"
  | "loading"
  | "loaded"
  | "failed";

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  /** HuggingFace model ID: "owner/repo/file.gguf" */
  huggingFaceId: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
  bytes: string;
  tags: string[];
  supportsReasoning?: boolean;
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

/** @deprecated Use `DownloadProgressInfo` from manager.ts instead. */
export interface DownloadProgress {
  modelId: string;
  progress: number; // 0-100
}
