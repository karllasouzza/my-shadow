/**
 * T034: Main barrel file for shared/ai/
 *
 * Re-exports all AI modules from their respective subdirectories.
 * This is the single entry point for all AI functionality.
 */

// Catalog layer
export * from "./catalog";

// Storage layer
export {
  setActiveModelId,
  clearActiveModelId,
  getActiveModelId,
  getDownloadedModelMap,
  replaceDownloadedModelMap,
  setDownloadedModelPath,
  removeDownloadedModelKey,
} from "./manager/storage";

// Path resolution
export * from "./manager/paths";

// Download engine
export { downloadFileAtomically, ensureDirectoryExists } from "./manager/download";

// Validation engine
export {
  fileExists,
  verifyModelFile,
  hasEnoughDiskSpace,
  hasEnoughRam,
} from "./manager/validation";

// Manager (orchestrator)
export { ModelManager, getModelManager } from "./manager/model-manager.service";

// Runtime layer
export { LocalAIRuntimeService, getLocalAIRuntime } from "./runtime/local-ai-runtime.service";

// Types & Constants (unified)
export * from "./types";
export * from "./constants";

// Error system
export * from "./errors";
