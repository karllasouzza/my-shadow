// Singleton export
export { TextEngine } from "./engine";
export { getTextEngine } from "./singleton";

// Types
export { fail, ok } from "./types";
export type {
    CompletionOutput,
    CompletionTimings, ContextConfig, EngineError,
    EngineErrorCode, EngineState,
    GenerateOptions, JSONSchemaObject, LoadedModel, Message,
    MessageRole, ModelId, RamTier, Result, StreamAccumulator, StreamEvent, ThinkingState, ToolCall, ToolDefinitionForEngine,
    ToolResultForEngine
} from "./types";

// Catalog
export { findModelById, getAllModels, getModelsByRam } from "./catalog";

// Config
export { buildContextConfig } from "./config";
