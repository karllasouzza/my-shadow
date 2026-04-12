/**
 * Shared AI - Barrel File
 *
 * Ponto único de entrada para todo o módulo shared/ai/
 */

// Types
export type {
    ChatMessage,
    CompletionOptions,
    CompletionOutput,
    DownloadProgress,
    LoadedModel,
    ModelCatalogEntry,
    ModelStatus,
    OnTokenCallback,
    StreamCompletionOptions
} from "./types";

// Catalog
export {
    findModelById,
    getAllModels,
    getModelsByRam,
    MODEL_CATALOG
} from "./catalog";

// Manager
export {
    downloadModelById,
    getDownloadedModels,
    getModelLocalPath,
    hasEnoughDisk,
    hasEnoughRam,
    isModelDownloaded,
    removeDownloadedModel,
    type DownloadProgressInfo,
    type OnDownloadProgress
} from "./manager";

// Runtime
export { AIRuntime, getAIRuntime } from "./runtime";

// Model Loader
export {
    autoLoadLastModel,
    getAvailableModels,
    getSelectedModelId,
    loadModel,
    unloadModel,
    type AvailableModel,
    type ModelLoadResult
} from "./model-loader";

