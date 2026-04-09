# Contract: Local AI Runtime Interface

## Purpose

Defines the public interface of `LocalAIRuntimeService` that all consumers depend on. This contract MUST remain stable during the migration from ExecuTorch to llama.rn to avoid breaking changes in reflection, review, and export services.

## Runtime Interface

### Initialization

```typescript
interface LocalAIRuntimeService {
  /**
   * Initialize the AI runtime. Must be called before any generation.
   * Safe to call multiple times (idempotent).
   */
  initialize(): Promise<Result<void>>;

  /**
   * Wait for runtime to be ready.
   */
  waitReady(): Promise<void>;

  /**
   * Check if runtime is available.
   */
  isAvailable(): boolean;
}
```

### Model Management

```typescript
  /**
   * Load a model into memory.
   * @param modelId - Model identifier key (e.g., "qwen2.5-0.5b-quantized")
   * @param modelPath - File path to .gguf model (file:// URI or absolute path)
   * @returns Model metadata on success
   */
  loadModel(modelId: string, modelPath: string): Promise<Result<LlamaModel>>

  /**
   * Check if a model is loaded.
   */
  isModelLoaded(modelId?: string): boolean

  /**
   * Get current loaded model metadata.
   */
  getCurrentModel(): LlamaModel | null

  /**
   * Unload current model from memory.
   */
  unloadModel(): Promise<Result<void>>
```

### Generation

```typescript
  /**
   * Generate a text completion from the loaded model.
   * @param messages - Chat messages array (system, user, assistant roles)
   * @param options - Optional streaming callback and timeout configuration
   * @returns Generated text with token counts
   *
   * Guarantees:
   * - Streams tokens via options.onToken callback as they are generated
   * - Times out after options.timeoutMs (default 60s) with LOCAL_GENERATION_UNAVAILABLE error
   * - Enforces Brazilian Portuguese output via system prompt
   * - Validates prompt length does not exceed contextLength - RESERVED_RESPONSE_TOKENS
   */
  generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<Result<CompletionOutput>>

  /**
   * Tokenize text using loaded model's tokenizer.
   */
  tokenize(text: string): Promise<Result<number[]>>

  /**
   * Generate guided reflection questions from user input.
   * High-level method that wraps generateCompletion with Jungian pt-BR prompts.
   */
  generateGuidedQuestions(prompt: string, numQuestions?: number): Promise<Result<string[]>>
```

### Generation Options

```typescript
interface CompletionOptions {
  /**
   * Called for each token as it is generated (streaming).
   */
  onToken?: (token: string) => void;

  /**
   * Maximum time in milliseconds before generation is aborted.
   * Defaults to 60000 (60 seconds).
   */
  timeoutMs?: number;

  /**
   * Maximum number of tokens to generate.
   * Defaults to 512.
   */
  maxTokens?: number;
}
```

### Status

```typescript
  /**
   * Get runtime status including loaded model and memory info.
   */
  getStatus(): Promise<LocalAIRuntimeStatus>
}
```

## Data Types

### ChatMessage

```typescript
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

### LlamaModel

```typescript
interface LlamaModel {
  id: string; // Model identifier
  name: string; // Human-readable name
  path: string; // File path to .gguf
  sizeBytes: number; // Model file size
  contextLength: number; // Context window (e.g., 4096)
  isLoaded: boolean; // Whether model is in memory
}
```

### CompletionOutput

```typescript
interface CompletionOutput {
  text: string; // Generated text
  promptTokens: number; // Tokens in input
  completionTokens: number; // Tokens in output
  totalTokens: number; // Total tokens processed
}
```

### LocalAIRuntimeStatus

```typescript
interface LocalAIRuntimeStatus {
  initialized: boolean;
  modelLoaded: boolean;
  currentModel?: LlamaModel;
  availableMemory?: number;
  totalMemory?: number;
  tokenizerVocabSize?: number;
}
```

### Result Type

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: AppError };

interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

type AppErrorCode =
  | "NOT_READY"
  | "VALIDATION_ERROR"
  | "LOCAL_GENERATION_UNAVAILABLE"
  | "RETRY_QUEUE_ERROR"
  | "SECURITY_LOCK_REQUIRED"
  | "NOT_FOUND"
  | "STORAGE_ERROR"
  | "UNKNOWN_ERROR";
```

## Behavioral Contracts

### Model Loading Guarantees

1. **Idempotent**: Calling `loadModel()` with the same modelId that is already loaded returns cached result without reloading
2. **Exclusive**: Only one model can be loaded at a time. Loading a new model unloads the previous one
3. **Async**: All model loading is asynchronous and does not block the main thread
4. **File Format**: Model path MUST point to a `.gguf` file (not `.pte` or other formats)

### Generation Guarantees

1. **Streaming**: `generateCompletion()` MUST stream tokens via callback as they are generated
2. **Timeout**: Generation MUST timeout after 60 seconds with `LOCAL_GENERATION_UNAVAILABLE` error
3. **Language**: System prompt MUST enforce Brazilian Portuguese output
4. **Token Limits**: Prompt length MUST not exceed `contextLength - RESERVED_RESPONSE_TOKENS`

### Error Handling

1. **Graceful Degradation**: When runtime is unavailable, methods MUST return `Result` with appropriate error (not throw)
2. **Recovery**: Failed model loads MUST leave runtime in clean state (ready for retry)
3. **No Silent Failures**: All errors MUST be logged and returned to caller

## Implementation Notes (llama.rn specific)

### Model Initialization Mapping

```typescript
// llama.rn internal:
import { initLlama } from "llama.rn";

const context = await initLlama({
  model: modelPath, // file:// URI to .gguf
  use_mlock: true, // Lock memory (prevents swap)
  n_ctx: contextLength, // From model config (default 4096)
  n_gpu_layers: 99, // GPU offload (Android: OpenCL)
  embedding: false, // LLM mode (not embedding)
});
```

### Completion Mapping

```typescript
// llama.rn internal:
const result = await context.completion(
  {
    messages, // ChatMessage[]
    n_predict: 256, // Max output tokens
    stop: ["</s>", "<|end|>"], // Stop sequences
  },
  ({ token }) => streamCallback(token),
);

// Convert to CompletionOutput:
return {
  text: result.text,
  promptTokens: result.promptTokens,
  completionTokens: result.completionTokens,
  totalTokens: result.promptTokens + result.completionTokens,
};
```

## RAG Integration Contract

The `ReflectionRAGRepository` depends on an embedding generation interface:

```typescript
interface EmbeddingService {
  /**
   * Generate embedding vector for text.
   * @returns Float32Array of embedding dimensions (typically 384)
   */
  generateEmbedding(text: string): Promise<Result<Float32Array>>;
}
```

**Current Implementation**: Uses `ExecuTorchEmbeddings` from `@react-native-rag/executorch`
**Future Migration**: Can use llama.rn with GGUF embedding model (`multi-qa-minilm-l6.gguf`)

**Vector Compatibility**:

- rag-content.db contains embeddings generated by `multi-qa-minilm-l6-cos-v1`
- Any replacement embedding model MUST produce compatible vector dimensions (384)
- Cosine similarity MUST work between old and new embeddings (verify during migration)

## Version History

| Version | Date       | Change                                       |
| ------- | ---------- | -------------------------------------------- |
| 1.0     | 2026-04-07 | Initial contract (ExecuTorch)                |
| 2.0     | 2026-04-08 | Updated for llama.rn migration (GGUF format) |
