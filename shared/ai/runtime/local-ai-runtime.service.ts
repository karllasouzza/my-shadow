/**
 * Local AI Runtime Service
 *
 * Manages the llama.rn lifecycle: initialization, model loading, text
 * generation, tokenization, and status reporting. All operations return
 * `Result<T>` wrappers for consistent error handling.
 *
 * The service enforces a context window limit of 3584 effective tokens
 * (DEFAULT_CONTEXT_LENGTH minus RESERVED_RESPONSE_TOKENS). Messages that
 * exceed this budget are truncated from the oldest end while preserving
 * the system prompt and the most recent messages.
 */

import { Platform } from "react-native";

import { LlamaContext, initLlama as initLlamaNative } from "llama.rn";

import {
    AppError,
    Result,
    createError,
    err,
    ok,
} from "@/shared/utils/app-error";
import {
    DEFAULT_CONTEXT_LENGTH,
    EFFECTIVE_CONTEXT_TOKENS,
    GENERATION_TIMEOUT_MS,
    MAX_CONTEXT_MESSAGES,
    RESERVED_RESPONSE_TOKENS,
} from "../constants";
import type {
    ChatMessage,
    CompletionOptions,
    CompletionOutput,
    LlamaModel,
    LocalAIRuntimeStatus,
} from "../types";
import { diagnoseModelFile, resolveModelPath } from "./model-file";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Type guard that narrows `unknown` to `AppError`. */
function isAppError(value: unknown): value is AppError {
  if (!value || typeof value !== "object") {
    return false;
  }
  return "code" in value && "message" in value;
}

/**
 * Truncates the message list so that the total token count fits within the
 * effective context window (3584 tokens). Keeps the system message intact
 * and removes the oldest messages first, up to `MAX_CONTEXT_MESSAGES`.
 */
async function truncateToContextWindow(
  messages: ChatMessage[],
  context: LlamaContext,
): Promise<ChatMessage[]> {
  // If the message count is already within bounds, return as-is.
  if (messages.length <= MAX_CONTEXT_MESSAGES) {
    const fullText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const { tokens } = await context.tokenize(fullText);
    if (tokens.length <= EFFECTIVE_CONTEXT_TOKENS) {
      return messages;
    }
  }

  // Separate system prompt from the rest.
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  // Take the most recent messages up to MAX_CONTEXT_MESSAGES.
  let window = nonSystem.slice(-MAX_CONTEXT_MESSAGES);

  // Iteratively drop the oldest message until we fit the token budget.
  while (window.length > 0) {
    const fullText = [...systemMessages, ...window]
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const { tokens } = await context.tokenize(fullText);
    if (tokens.length <= EFFECTIVE_CONTEXT_TOKENS) {
      break;
    }
    window = window.slice(1);
  }

  return [...systemMessages, ...window];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LocalAIRuntimeService {
  private initialized = false;
  private currentModel: LlamaModel | null = null;
  private runtimeReady: Promise<void>;
  private resolveReady!: () => void;
  private bootstrapPromise: Promise<Result<void>> | null = null;
  private context: LlamaContext | null = null;

  constructor() {
    this.runtimeReady = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  /**
   * Initializes the runtime. On web platforms this always fails because
   * `llama.rn` requires native APIs. Safe to call multiple times; subsequent
   * calls return immediately.
   */
  async initialize(): Promise<Result<void>> {
    if (this.initialized) {
      return ok(void 0);
    }

    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.bootstrapPromise = (async () => {
      try {
        if (Platform.OS === "web") {
          return err(
            createError(
              "NOT_READY",
              "Local llama.rn runtime is unavailable on web platform",
            ),
          );
        }

        this.initialized = true;
        this.resolveReady();
        return ok(void 0);
      } catch (error) {
        return err(
          createError(
            "NOT_READY",
            "Failed to initialize local AI runtime",
            {},
            error as Error,
          ),
        );
      }
    })();

    const result = await this.bootstrapPromise;
    if (!result.success) {
      this.bootstrapPromise = null;
    }

    return result;
  }

  /** Resolves when the runtime has finished initializing. */
  async waitReady(): Promise<void> {
    return this.runtimeReady;
  }

  /**
   * Loads a GGUF model into the llama.rn context.
   *
   * @param modelId  - Logical identifier for the model.
   * @param modelPath - Absolute `file://` path to the GGUF file (will be
   *   normalized via `resolveModelPath` if missing the scheme).
   */
  async loadModel(
    modelId: string,
    modelPath: string,
  ): Promise<Result<LlamaModel>> {
    try {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return err(initResult.error);
      }

      if (!modelPath || modelPath.trim().length === 0) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "modelPath is required and cannot be empty. Provide an absolute GGUF file path.",
            { modelId },
          ),
        );
      }

      const resolvedPath = resolveModelPath(modelPath);

      if (this.currentModel?.id === modelId) {
        return ok(this.currentModel);
      }

      if (this.context) {
        await this.unloadModel();
      }

      const diagnostics = await diagnoseModelFile(resolvedPath);
      if (!diagnostics.isValid) {
        return err(
          createError(
            "VALIDATION_ERROR",
            diagnostics.errorMessage,
            diagnostics.details,
          ),
        );
      }

      try {
        this.context = await initLlamaNative({
          model: resolvedPath,
          use_mlock: true,
          n_ctx: DEFAULT_CONTEXT_LENGTH,
          n_gpu_layers: 0,
        });

        const model: LlamaModel = {
          id: modelId,
          name: modelId,
          path: resolvedPath,
          sizeBytes: Number(diagnostics.details.size ?? 0),
          contextLength: DEFAULT_CONTEXT_LENGTH,
          isLoaded: true,
        };

        this.currentModel = model;
        return ok(model);
      } catch (initError) {
        return err(
          createError(
            "NOT_READY",
            "Failed to load model",
            {
              modelId,
              resolvedPath,
              errorMessage:
                initError instanceof Error
                  ? initError.message
                  : "Unknown error",
            },
            initError as Error,
          ),
        );
      }
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Failed to load model",
          {
            modelId,
            modelPath,
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
          error as Error,
        ),
      );
    }
  }

  /**
   * Checks whether a model is loaded and ready for generation.
   *
   * @param modelId - When provided, verifies that the currently loaded model
   *   matches this ID.
   */
  isModelLoaded(modelId?: string): boolean {
    if (!this.initialized) return false;
    if (!this.currentModel) return false;
    if (!this.context) return false;
    if (modelId && this.currentModel.id !== modelId) return false;
    return this.currentModel.isLoaded;
  }

  /** Returns the currently loaded model metadata, or `null`. */
  getCurrentModel(): LlamaModel | null {
    return this.currentModel;
  }

  /**
   * Tokenizes a string using the currently loaded model.
   *
   * @returns An array of token IDs.
   */
  async tokenize(text: string): Promise<Result<number[]>> {
    try {
      const modelResult = await this.ensureDefaultModelLoaded();
      if (!modelResult.success) {
        return err(modelResult.error);
      }

      const { tokens } = await this.context!.tokenize(text);
      return ok(tokens);
    } catch (error) {
      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Failed to tokenize prompt",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Generates a completion for the given chat messages.
   *
   * Messages are automatically truncated if their combined token count
   * exceeds the effective context window (3584 tokens). The system prompt
   * is always preserved.
   *
   * @param messages - Chat history in OpenAI-compatible format.
   * @param options  - Optional generation parameters (maxTokens, timeout,
   *   onToken callback).
   */
  async generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<Result<CompletionOutput>> {
    const timeoutMs = options?.timeoutMs ?? GENERATION_TIMEOUT_MS;
    const maxTokens = options?.maxTokens ?? 512;
    const onToken = options?.onToken;

    try {
      const modelResult = await this.ensureDefaultModelLoaded();
      if (!modelResult.success) {
        return err(modelResult.error);
      }

      // Truncate messages to fit within the effective context window.
      const windowedMessages = await truncateToContextWindow(
        messages,
        this.context!,
      );

      const promptText = windowedMessages
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");

      const { tokens: promptTokens } = await this.context!.tokenize(promptText);

      const maxPromptTokens =
        (this.currentModel?.contextLength ?? DEFAULT_CONTEXT_LENGTH) -
        RESERVED_RESPONSE_TOKENS;

      if (promptTokens.length > maxPromptTokens) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Prompt is too long for current model context window",
            {
              promptTokens: promptTokens.length,
              maxPromptTokens,
            },
          ),
        );
      }

      let streamed = "";
      const completionPromise = this.context!.completion(
        {
          messages: windowedMessages,
          n_predict: maxTokens,
          stop: ["</s>", "<|end|>", "\nUser:"],
        },
        ({ token }) => {
          streamed += token;
          onToken?.(token);
        },
      );

      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            createError(
              "LOCAL_GENERATION_UNAVAILABLE",
              `Generation timed out after ${timeoutMs}ms`,
              { timeoutMs },
            ),
          );
        }, timeoutMs);
      });

      const generatedText = await Promise.race([
        completionPromise,
        timeoutPromise,
      ]).finally(() => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      });

      const text = (generatedText?.text || streamed || "").trim();
      if (!text) {
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            "Model returned an empty completion",
          ),
        );
      }

      const { tokens: completionTokens } = await this.context!.tokenize(text);

      return ok({
        text,
        promptTokens: promptTokens.length,
        completionTokens: completionTokens.length,
        totalTokens: promptTokens.length + completionTokens.length,
      });
    } catch (error) {
      if (isAppError(error)) {
        return err(error);
      }

      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Failed to generate completion",
          {},
          error as Error,
        ),
      );
    }
  }

  /** Returns the current runtime status snapshot. */
  async getStatus(): Promise<LocalAIRuntimeStatus> {
    return {
      initialized: this.initialized,
      modelLoaded: this.currentModel?.isLoaded ?? false,
      currentModel: this.currentModel ?? undefined,
      tokensPerSecond: undefined,
    };
  }

  /**
   * Unloads the current model and releases the native context, freeing
   * memory held by llama.rn.
   */
  async unloadModel(): Promise<Result<void>> {
    try {
      if (!this.currentModel || !this.context) {
        return ok(void 0);
      }

      this.context.release();
      this.context = null;
      this.currentModel = null;

      return ok(void 0);
    } catch (error) {
      return err(
        createError("NOT_READY", "Failed to unload model", {}, error as Error),
      );
    }
  }

  /** Whether the runtime has been initialized (regardless of model state). */
  isAvailable(): boolean {
    return this.initialized;
  }

  private async ensureDefaultModelLoaded(): Promise<Result<void>> {
    const initResult = await this.initialize();
    if (!initResult.success) {
      return err(initResult.error);
    }

    if (this.isModelLoaded()) {
      return ok(void 0);
    }

    return err(
      createError(
        "NOT_READY",
        "No model is currently loaded. Call loadModel() with a valid GGUF file path first.",
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let runtimeInstance: LocalAIRuntimeService;

/**
 * Returns the singleton instance of `LocalAIRuntimeService`.
 */
export function getLocalAIRuntime(): LocalAIRuntimeService {
  if (!runtimeInstance) {
    runtimeInstance = new LocalAIRuntimeService();
  }

  return runtimeInstance;
}
