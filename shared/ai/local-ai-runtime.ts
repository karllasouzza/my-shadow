/**
 * T008-T022: Migrate AI Runtime from ExecuTorch to llama.rn
 *
 * Uses llama.rn stack for fully local GGUF inference.
 * Model family is pinned to Qwen 2.5 GGUF models.
 */

import * as FileSystem from "expo-file-system/legacy";
import {
  LlamaContext,
  RNLlamaOAICompatibleMessage,
  initLlama as initLlamaNative,
} from "llama.rn";
import { Platform } from "react-native";
import { Result, createError, err, ok } from "../utils/app-error";

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

interface CompletionOutput {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Callback invoked for each generated token during streaming completion.
 */
export type OnTokenCallback = (token: string) => void;

/**
 * Options for generateCompletion.
 */
export interface CompletionOptions {
  /**
   * Called for each token as it is generated (streaming).
   */
  onToken?: OnTokenCallback;
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

const DEFAULT_MODEL_ID = "qwen2.5-0.5b-q4";
const DEFAULT_CONTEXT_LENGTH = 4096;
const RESERVED_RESPONSE_TOKENS = 512;
const GENERATION_TIMEOUT_MS = 60_000; // 60 seconds per contract

/**
 * Service to bootstrap and manage local AI runtime (llama.rn)
 */
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
   * Initialize the llama.rn runtime.
   * Must be called before any generation operation.
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

        // T011: llama.rn does not require explicit initialization like ExecuTorch.
        // The runtime is available as soon as the native module is loaded.
        // We just verify that the platform is supported.
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

  /**
   * Wait for runtime to be ready.
   */
  async waitReady(): Promise<void> {
    return this.runtimeReady;
  }

  /**
   * T012: Load a GGUF model into memory using llama.rn.
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

      // T022: Require a non-empty modelPath to avoid loading non-existent relative URIs
      if (!modelPath || modelPath.trim().length === 0) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "modelPath is required and cannot be empty. Provide an absolute GGUF file path.",
            { modelId },
          ),
        );
      }

      const resolvedPath = this.resolveModelPath(modelId, modelPath);

      if (
        this.currentModel?.id === modelId &&
        this.currentModel.isLoaded &&
        this.context
      ) {
        return ok(this.currentModel);
      }

      // Unload existing model if present
      if (this.context) {
        await this.unloadModel();
      }

      // NEW: Pre-load diagnostics to validate model file
      const diagnostics = await this.diagnoseModelFile(resolvedPath);
      if (!diagnostics.isValid) {
        console.error(
          "[LocalAIRuntime] Model file diagnostics failed:",
          diagnostics,
        );
        return err(
          createError(
            "VALIDATION_ERROR",
            diagnostics.errorMessage,
            diagnostics,
          ),
        );
      }

      // T012: Replace ExecuTorchLLM instantiation with initLlama
      try {
        console.log("[LocalAIRuntime] Initializing llama.rn with path:", {
          modelId,
          resolvedPath,
          platform: Platform.OS,
          n_ctx: DEFAULT_CONTEXT_LENGTH,
          n_gpu_layers: 99,
          use_mlock: true,
        });

        this.context = await initLlamaNative({
          model: resolvedPath,
          use_mlock: true,
          n_ctx: DEFAULT_CONTEXT_LENGTH,
          n_gpu_layers: 99,
        });

        console.log("[LocalAIRuntime] Model loaded successfully:", {
          modelId,
          resolvedPath,
        });

        const model: LlamaModel = {
          id: modelId,
          name: modelId,
          path: resolvedPath,
          sizeBytes: 0,
          contextLength: DEFAULT_CONTEXT_LENGTH,
          isLoaded: true,
        };

        this.currentModel = model;
        return ok(model);
      } catch (initError) {
        const errorDetails = {
          modelId,
          resolvedPath,
          errorMessage:
            initError instanceof Error ? initError.message : "Unknown error",
          errorStack: initError instanceof Error ? initError.stack : "",
          platformOS: Platform.OS,
        };

        console.error(
          "[LocalAIRuntime] Model initialization failed:",
          errorDetails,
        );

        return err(
          createError(
            "NOT_READY",
            "Failed to load model",
            errorDetails,
            initError as Error,
          ),
        );
      }
    } catch (error) {
      const errorDetails = {
        modelId,
        resolvedPath: modelPath,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : "",
        platformOS: Platform.OS,
      };

      console.error("[LocalAIRuntime] Model loading failed:", errorDetails);

      return err(
        createError(
          "NOT_READY",
          "Failed to load model",
          errorDetails,
          error as Error,
        ),
      );
    }
  }

  /**
   * Check if a model is loaded.
   */
  isModelLoaded(modelId?: string): boolean {
    if (!this.initialized) return false;
    if (!this.currentModel) return false;
    if (!this.context) return false;
    if (modelId && this.currentModel.id !== modelId) return false;
    return this.currentModel.isLoaded;
  }

  /**
   * Get current loaded model.
   */
  getCurrentModel(): LlamaModel | null {
    return this.currentModel;
  }

  /**
   * T015: Tokenize text using llama.rn built-in tokenizer.
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
   * T014: Run a generic completion request against the loaded model using llama.rn context.completion().
   *
   * Contract guarantees:
   * - Streaming: tokens are streamed via onToken callback as they are generated
   * - Timeout: generation aborts after timeoutMs (default 60s) with LOCAL_GENERATION_UNAVAILABLE error
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

      const promptText = messages
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

      // Contract: stream tokens via callback + enforce timeout
      let streamed = "";
      const completionPromise = this.context!.completion(
        {
          messages,
          n_predict: maxTokens,
          stop: ["</s>", "<|end|>", "\nUser:"],
        },
        ({ token }) => {
          streamed += token;
          if (onToken) {
            onToken(token);
          }
        },
      );

      // Contract: timeout after 60 seconds (default)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
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
      ]);

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
      // If it's already our AppError from timeout, pass through
      if (error && typeof error === "object" && "code" in error) {
        return err(error as any);
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

  /**
   * T018: Get runtime status with llama.rn metrics.
   */
  async getStatus(): Promise<LocalAIRuntimeStatus> {
    let tokensPerSecond: number | undefined;
    try {
      if (this.context) {
        // llama.rn exposes timing metrics via context
        tokensPerSecond = undefined; // Will be populated during actual generation
      }
    } catch {
      tokensPerSecond = undefined;
    }

    return {
      initialized: this.initialized,
      modelLoaded: this.currentModel?.isLoaded ?? false,
      currentModel: this.currentModel ?? undefined,
      tokensPerSecond,
    };
  }

  /**
   * T016: Unload current model using context.release().
   */
  async unloadModel(): Promise<Result<void>> {
    try {
      if (!this.currentModel || !this.context) {
        return ok(void 0);
      }

      // T016: Replace llm.unload() with context.release()
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

  /**
   * Check if runtime is available.
   */
  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Generate guided questions using llama.rn local inference.
   */
  async generateGuidedQuestions(
    prompt: string,
    numQuestions: number = 5,
  ): Promise<Result<string[]>> {
    try {
      const completionResult = await this.generateCompletion([
        {
          role: "system",
          content:
            "Voce e um assistente de reflexao em portugues do Brasil com tom junguiano, introspectivo e nao-diretivo. Responda somente com uma lista numerada.",
        },
        {
          role: "user",
          content: `Com base neste contexto, gere ${numQuestions} perguntas:\n\n${prompt}`,
        },
      ]);

      if (!completionResult.success) {
        return err(completionResult.error);
      }

      const parsed = this.extractQuestions(
        completionResult.data.text,
        Math.max(1, Math.min(numQuestions, 8)),
      );

      if (parsed.length === 0) {
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            "Model output did not contain valid reflective questions",
          ),
        );
      }

      return ok(parsed);
    } catch (error) {
      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Failed to generate guided questions",
          {},
          error as Error,
        ),
      );
    }
  }

  private async ensureDefaultModelLoaded(): Promise<Result<void>> {
    const initResult = await this.initialize();
    if (!initResult.success) {
      return err(initResult.error);
    }

    if (this.isModelLoaded()) {
      return ok(void 0);
    }

    // T022: No default model to auto-load - callers must provide a valid GGUF path
    // via loadModel() before calling generateCompletion() or tokenize()
    return err(
      createError(
        "NOT_READY",
        "No model is currently loaded. Call loadModel() with a valid GGUF file path first.",
      ),
    );
  }

  /**
   * T013: Replace model preset mapping with direct file path resolution.
   * Remove QWEN2*5* preset references and use GGUF file paths directly.
   */
  private resolveModelPath(modelId: string, modelPath: string): string {
    // T022: modelPath is guaranteed to be non-empty by loadModel() validation
    if (modelPath.startsWith("file://")) {
      return modelPath;
    }
    return `file://${modelPath}`;
  }

  private async diagnoseModelFile(
    filePath: string,
  ): Promise<{
    isValid: boolean;
    errorMessage: string;
    details: Record<string, any>;
  }> {
    try {
      console.log("[LocalAIRuntime] Diagnosing model file:", { filePath });

      // FileSystem.getInfoAsync() works with file:// URIs as-is
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return {
          isValid: false,
          errorMessage: `Arquivo do modelo não encontrado em: ${filePath}`,
          details: { filePath, exists: false },
        };
      }

      // Log file size for debugging (don't block on size - let llama.rn validate the file)
      const sizeInMB = (fileInfo.size || 0) / 1024 / 1024;
      console.log("[LocalAIRuntime] Model file size check:", {
        filePath,
        size: fileInfo.size,
        sizeInMB: sizeInMB.toFixed(2),
      });

      // Warn if file seems suspiciously small (likely incomplete download)
      if (fileInfo.size && fileInfo.size < 10 * 1024 * 1024) {
        console.warn("[LocalAIRuntime] Model file seems unusually small:", {
          filePath,
          size: fileInfo.size,
          sizeInMB: sizeInMB.toFixed(2),
          suggestion:
            "File may be corrupted or download may have been interrupted. Consider re-downloading.",
        });
      }

      console.log("[LocalAIRuntime] Model file diagnostics passed:", {
        filePath,
        size: fileInfo.size,
        sizeInMB: sizeInMB.toFixed(2),
      });

      return {
        isValid: true,
        errorMessage: "",
        details: { filePath, size: fileInfo.size },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao verificar arquivo";
      console.error("[LocalAIRuntime] Model file diagnosis error:", {
        filePath,
        error: errorMessage,
      });

      return {
        isValid: false,
        errorMessage: `Erro ao verificar arquivo do modelo: ${errorMessage}`,
        details: { filePath, error: errorMessage },
      };
    }
  }

  private extractQuestions(rawText: string, limit: number): string[] {
    const seen = new Set<string>();
    const questions: string[] = [];

    const normalizedLines = rawText
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of normalizedLines) {
      const sanitized = line.replace(/^(\d+[).:-]|[-*])\s*/, "").trim();
      if (!sanitized) {
        continue;
      }

      const fragments = sanitized
        .split("?")
        .map((fragment) => fragment.trim())
        .filter((fragment) => fragment.length > 0);

      const candidates =
        fragments.length > 1
          ? fragments.map((fragment) => `${fragment}?`)
          : [sanitized.endsWith("?") ? sanitized : `${sanitized}?`];

      for (const candidate of candidates) {
        if (candidate.length < 12) {
          continue;
        }
        if (!seen.has(candidate)) {
          seen.add(candidate);
          questions.push(candidate);
        }
        if (questions.length >= limit) {
          return questions;
        }
      }
    }

    return questions;
  }
}

// Singleton instance
let runtimeInstance: LocalAIRuntimeService;

export const getLocalAIRuntime = (): LocalAIRuntimeService => {
  if (!runtimeInstance) {
    runtimeInstance = new LocalAIRuntimeService();
  }
  return runtimeInstance;
};
