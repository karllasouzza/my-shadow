/**
 * T004: Unified types for shared/ai/
 *
 * Consolidates all type definitions from manager/, runtime/, and catalog/
 * into a single source of truth.
 */

import type { RNLlamaOAICompatibleMessage } from "llama.rn";

// ============================================================================
// Catalog Types
// ============================================================================

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  downloadUrl: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
  params: string;
  tags: string[];
}

// ============================================================================
// Model Status Types
// ============================================================================

export type ModelStatus =
  | "not-downloaded"
  | "downloading"
  | "downloaded"
  | "loaded"
  | "failed";

export interface DownloadedModel {
  modelId: string;
  localPath: string;
  downloadedAt: number;
}

// ============================================================================
// Download Types
// ============================================================================

export interface DownloadState {
  active: boolean;
  progress: number;
  cancelled: boolean;
}

export interface DownloadedFile {
  uri: string;
  sizeBytes: number;
}

export interface ResumableRef {
  current: import("expo-file-system/legacy").DownloadResumable | null;
}

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  percent: number;
}

// ============================================================================
// Runtime Types
// ============================================================================

export type ChatMessage = RNLlamaOAICompatibleMessage;

export interface LlamaModel {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  contextLength: number;
  isLoaded: boolean;
}

export interface LocalAIRuntimeStatus {
  initialized: boolean;
  modelLoaded: boolean;
  currentModel?: LlamaModel;
  availableMemory?: number;
  totalMemory?: number;
  tokensPerSecond?: number;
}

export interface CompletionOutput {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type OnTokenCallback = (token: string) => void;

export interface CompletionOptions {
  onToken?: OnTokenCallback;
  timeoutMs?: number;
  maxTokens?: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ModelFileDiagnostics {
  isValid: boolean;
  errorMessage: string;
  details: Record<string, unknown>;
}

export interface DiskSpaceCheck {
  hasEnoughSpace: boolean;
  freeBytes: number;
  requiredBytes: number;
}

export interface RamCheck {
  hasEnoughRam: boolean;
  totalRamBytes: number;
  requiredRamBytes: number;
  warning: string | null;
}

// ============================================================================
// Storage Types
// ============================================================================

export type DownloadedModelMap = Record<string, string>;

export interface ModelConfigStorage {
  activeModelId: string | null;
  downloadedModels: DownloadedModelMap;
}

// ============================================================================
// Manager Types
// ============================================================================

export interface ModelManagerState {
  activeModelId: string | null;
  downloadedModels: DownloadedModelMap;
  downloadState: DownloadState;
  loadedModelId: string | null;
  errorMessage: string | null;
}

export type ModelOperationResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: Error & { code?: string; details?: Record<string, unknown> } };

// ============================================================================
// Download Options
// ============================================================================

export interface DownloadFileOptions {
  url: string;
  destinationUri: string;
  onProgress?: (progress: number) => void;
  resumableRef: ResumableRef;
  expectedSizeBytes?: number;
}
