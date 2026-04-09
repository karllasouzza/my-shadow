/**
 * T011: Implement local llama.rn runtime bootstrap service
 *
 * Uses ExecuTorch + llama.rn stack for fully local inference.
 * Model family is pinned to Qwen 2.5.
 */

import { Platform } from "react-native";
import { Result, createError, err, ok } from "../utils/app-error";

type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

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
  tokenizerVocabSize?: number;
}

interface ModelResourceConfig {
  modelName: string;
  modelSource: unknown;
  tokenizerSource: unknown;
  tokenizerConfigSource: unknown;
  contextLength: number;
}

interface RuntimeNativeModules {
  initExecutorch: (config: any) => void;
  TokenizerModule: any;
  QWEN2_5_0_5B: any;
  QWEN2_5_0_5B_QUANTIZED: any;
  QWEN2_5_1_5B: any;
  QWEN2_5_1_5B_QUANTIZED: any;
  QWEN2_5_3B: any;
  QWEN2_5_3B_QUANTIZED: any;
  ExpoResourceFetcher: unknown;
  ExecuTorchLLM: any;
}

interface CompletionOutput {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const DEFAULT_MODEL_ID = "qwen2.5-0.5b-quantized";
const DEFAULT_CONTEXT_LENGTH = 4096;
const RESERVED_RESPONSE_TOKENS = 512;

/**
 * Service to bootstrap and manage local AI runtime (llama.rn)
 */
export class LocalAIRuntimeService {
  private initialized = false;
  private currentModel: LlamaModel | null = null;
  private runtimeReady: Promise<void>;
  private resolveReady!: () => void;
  private bootstrapPromise: Promise<Result<void>> | null = null;

  private modules: RuntimeNativeModules | null = null;
  private llm: InstanceType<RuntimeNativeModules["ExecuTorchLLM"]> | null =
    null;
  private tokenizer: InstanceType<
    RuntimeNativeModules["TokenizerModule"]
  > | null = null;

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

        const modulesResult = await this.loadNativeModules();
        if (!modulesResult.success) {
          return err(modulesResult.error);
        }

        this.modules = modulesResult.data;
        this.modules.initExecutorch({
          resourceFetcher: this.modules.ExpoResourceFetcher,
        });

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
   * Load a model into memory.
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

      if (!this.modules) {
        return err(createError("NOT_READY", "Runtime modules were not loaded"));
      }

      const resource = this.resolveModelResource(modelId, modelPath);

      if (
        this.currentModel?.id === resource.modelName &&
        this.currentModel.isLoaded &&
        this.llm &&
        this.tokenizer
      ) {
        return ok(this.currentModel);
      }

      if (this.llm) {
        await this.llm.unload();
      }

      this.llm = new this.modules.ExecuTorchLLM({
        modelSource: resource.modelSource,
        tokenizerSource: resource.tokenizerSource,
        tokenizerConfigSource: resource.tokenizerConfigSource,
        chatConfig: {
          systemPrompt:
            "Voce e um assistente de reflexao em pt-BR com tom compassivo e introspectivo.",
        },
      });
      await this.llm.load();

      this.tokenizer = new this.modules.TokenizerModule();
      await this.tokenizer.load({ tokenizerSource: resource.tokenizerSource });

      const model: LlamaModel = {
        id: resource.modelName,
        name: resource.modelName,
        path:
          typeof resource.modelSource === "string"
            ? resource.modelSource
            : modelPath,
        sizeBytes: 0,
        contextLength: resource.contextLength,
        isLoaded: true,
      };

      this.currentModel = model;
      return ok(model);
    } catch (error) {
      return err(
        createError("NOT_READY", "Failed to load model", {}, error as Error),
      );
    }
  }

  /**
   * Check if a model is loaded.
   */
  isModelLoaded(modelId?: string): boolean {
    if (!this.initialized) return false;
    if (!this.currentModel) return false;
    if (!this.llm || !this.tokenizer) return false;
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
   * Tokenize text using the loaded tokenizer.
   */
  async tokenize(text: string): Promise<Result<number[]>> {
    try {
      const modelResult = await this.ensureDefaultModelLoaded();
      if (!modelResult.success) {
        return err(modelResult.error);
      }
      const tokens = await this.tokenizer!.encode(text);
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
   * Run a generic completion request against the loaded model.
   */
  async generateCompletion(
    messages: ChatMessage[],
  ): Promise<Result<CompletionOutput>> {
    try {
      const modelResult = await this.ensureDefaultModelLoaded();
      if (!modelResult.success) {
        return err(modelResult.error);
      }

      const promptText = messages
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");

      const promptTokens = await this.tokenizer!.encode(promptText);
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
      const generatedText = await this.llm!.generate(
        messages,
        (token: string) => {
          streamed += token;
        },
      );

      const text = (generatedText || streamed || "").trim();
      if (!text) {
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            "Model returned an empty completion",
          ),
        );
      }

      const completionTokens = await this.tokenizer!.encode(text);

      return ok({
        text,
        promptTokens: promptTokens.length,
        completionTokens: completionTokens.length,
        totalTokens: promptTokens.length + completionTokens.length,
      });
    } catch (error) {
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
   * Get runtime status.
   */
  async getStatus(): Promise<LocalAIRuntimeStatus> {
    let tokenizerVocabSize: number | undefined;
    try {
      if (this.tokenizer) {
        tokenizerVocabSize = await this.tokenizer.getVocabSize();
      }
    } catch {
      tokenizerVocabSize = undefined;
    }

    return {
      initialized: this.initialized,
      modelLoaded: this.currentModel?.isLoaded ?? false,
      currentModel: this.currentModel ?? undefined,
      tokenizerVocabSize,
    };
  }

  /**
   * Unload current model.
   */
  async unloadModel(): Promise<Result<void>> {
    try {
      if (!this.currentModel || !this.llm) {
        return ok(void 0);
      }

      await this.llm.unload();
      this.llm = null;
      this.tokenizer = null;
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
    return this.initialized && this.modules !== null;
  }

  /**
   * Generate guided questions using real local inference.
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
            "Gere perguntas de reflexao em portugues do Brasil com tom junguiano, introspectivo e nao-diretivo. Responda somente com uma lista numerada.",
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

    const modelResult = await this.loadModel(DEFAULT_MODEL_ID, "");
    if (!modelResult.success) {
      return err(modelResult.error);
    }

    return ok(void 0);
  }

  private resolveModelResource(
    modelId: string,
    modelPath: string,
  ): ModelResourceConfig {
    if (!this.modules) {
      throw new Error("Runtime modules are not loaded");
    }

    const modelMap: Record<string, ModelResourceConfig> = {
      [this.modules.QWEN2_5_0_5B.modelName]: {
        ...this.modules.QWEN2_5_0_5B,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      },
      [this.modules.QWEN2_5_0_5B_QUANTIZED.modelName]: {
        ...this.modules.QWEN2_5_0_5B_QUANTIZED,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      },
      [this.modules.QWEN2_5_1_5B.modelName]: {
        ...this.modules.QWEN2_5_1_5B,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      },
      [this.modules.QWEN2_5_1_5B_QUANTIZED.modelName]: {
        ...this.modules.QWEN2_5_1_5B_QUANTIZED,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      },
      [this.modules.QWEN2_5_3B.modelName]: {
        ...this.modules.QWEN2_5_3B,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      },
      [this.modules.QWEN2_5_3B_QUANTIZED.modelName]: {
        ...this.modules.QWEN2_5_3B_QUANTIZED,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      },
    };

    if (modelPath && modelPath.trim().length > 0) {
      return {
        modelName: modelId || DEFAULT_MODEL_ID,
        modelSource: modelPath,
        tokenizerSource: this.modules.QWEN2_5_0_5B_QUANTIZED.tokenizerSource,
        tokenizerConfigSource:
          this.modules.QWEN2_5_0_5B_QUANTIZED.tokenizerConfigSource,
        contextLength: DEFAULT_CONTEXT_LENGTH,
      };
    }

    return modelMap[modelId] ?? modelMap[DEFAULT_MODEL_ID];
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

  private async loadNativeModules(): Promise<Result<RuntimeNativeModules>> {
    try {
      const [executorchModule, ragExecuTorchModule, expoFetcherModule] =
        await Promise.all([
          import("react-native-executorch"),
          import("@react-native-rag/executorch"),
          import("react-native-executorch-expo-resource-fetcher"),
        ]);

      return ok({
        initExecutorch: executorchModule.initExecutorch,
        TokenizerModule: executorchModule.TokenizerModule,
        QWEN2_5_0_5B: executorchModule.QWEN2_5_0_5B,
        QWEN2_5_0_5B_QUANTIZED: executorchModule.QWEN2_5_0_5B_QUANTIZED,
        QWEN2_5_1_5B: executorchModule.QWEN2_5_1_5B,
        QWEN2_5_1_5B_QUANTIZED: executorchModule.QWEN2_5_1_5B_QUANTIZED,
        QWEN2_5_3B: executorchModule.QWEN2_5_3B,
        QWEN2_5_3B_QUANTIZED: executorchModule.QWEN2_5_3B_QUANTIZED,
        ExpoResourceFetcher: expoFetcherModule.ExpoResourceFetcher,
        ExecuTorchLLM: ragExecuTorchModule.ExecuTorchLLM,
      });
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Unable to load native AI dependencies",
          {},
          error as Error,
        ),
      );
    }
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
