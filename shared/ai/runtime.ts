import { Result, createError, err, ok } from "@/shared/utils/app-error";
import type { LlamaContext, TokenData } from "llama.rn";
import { initLlama, loadLlamaModelInfo } from "llama.rn";
import { findModelById } from "./catalog";
import type { ChatMessage } from "./types/chat";
import type {
  CompletionOutput,
  LoadedModel,
  StreamCompletionOptions,
} from "./types/runtime";

let runtimeInstance: AIRuntime | null = null;

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
];

export class AIRuntime {
  private currentModel: LoadedModel | null = null;
  private currentModelInfo: Object = {};
  private context: LlamaContext | null = null;
  private parallelStop: (() => Promise<void>) | null = null;

  /**
   * Loads a model into memory. If another model is already loaded, it will be unloaded first.
   */
  async loadModel(
    modelId: string,
    modelPath: string,
  ): Promise<Result<LoadedModel>> {
    try {
      if (this.context) {
        await this.unloadModel();
      }

      const modelInfo = await loadLlamaModelInfo(modelPath);
      this.currentModelInfo = modelInfo;

      this.context = await initLlama({
        model: modelPath,
        n_ctx: 2048,
        n_gpu_layers: 99,
        use_mlock: true,
        flash_attn_type: "on",
        cache_type_k: "f16",
        cache_type_v: "f16",
      });

      this.currentModel = { id: modelId, isLoaded: true };

      return ok(this.currentModel);
    } catch (error) {
      this.currentModel = null;
      this.context = null;

      return err(
        createError(
          "NOT_READY",
          "Falha ao carregar modelo na memória.",
          { modelId, modelPath },
          error as Error,
        ),
      );
    }
  }

  /**
   * Unloads the model from memory, freeing RAM.
   */
  async unloadModel(): Promise<Result<void>> {
    try {
      if (!this.context) return ok(undefined);

      await this.cancelGeneration();
      await this.context.parallel.disable().catch(() => {});
      this.context = null;
      this.currentModel = null;

      return ok(undefined);
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Falha ao descarregar modelo.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Streaming completion using llama.rn native .completion() with callback.
   *
   * Tokens are delivered in real-time via the onToken callback.
   * Supports abort and thinking toggle.
   */
  async streamCompletion(
    messages: ChatMessage[],
    options?: StreamCompletionOptions,
  ): Promise<Result<CompletionOutput>> {
    if (!this.context || !this.currentModel) {
      return err(
        createError(
          "NOT_READY",
          "Nenhum modelo carregado. Carregue um modelo antes de gerar texto.",
        ),
      );
    }

    try {
      let fullResponse = "";
      let fullReasoning = "";
      let aborted = false;

      const currentModelSupportsReasoning =
        findModelById(this.currentModel.id)?.supportsReasoning ?? false;
      const enableThinking =
        options?.enableThinking && currentModelSupportsReasoning;

      // Always accumulate tokens internally for the final result
      const streamCallback = (data: {
        token: string;
        reasoningContent: string;
      }) => {
        if (data.token) fullResponse += data.token;
        if (data.reasoningContent) fullReasoning += data.reasoningContent;
        // Forward to caller callback
        options?.onStreamChunk?.(data);
        // Legacy fallback
        if (!options?.onStreamChunk && data.token) {
          options?.onToken?.(data.token);
        }
      };

      // Enable parallel mode if not already enabled
      await this.context.parallel.enable({ n_parallel: 1 });

      const { promise, stop } = await this.context.parallel.completion(
        {
          messages,
          jinja: true,
          thinking_forced_open: enableThinking,
          enable_thinking: enableThinking,
          n_predict: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          stop: STOP_WORDS,
        },
        (_requestId: number, data: TokenData) => {
          const token = data.token ?? "";
          const reasoning = data.reasoning_content ?? "";
          if (token || reasoning) {
            streamCallback({ token, reasoningContent: reasoning });
          }
        },
      );

      this.parallelStop = stop;

      if (options?.abortSignal) {
        options.abortSignal.addEventListener("abort", () => {
          aborted = true;
          this.cancelGeneration();
        });
      }

      await promise;
      this.parallelStop = null;

      // Disable parallel mode after completion
      await this.context.parallel.disable();

      if (aborted) {
        return err(createError("ABORTED", "Geração cancelada pelo usuário."));
      }

      // Return combined text: reasoning + response
      // The caller (use-chat) separates them via onStreamChunk
      const combinedText = fullReasoning
        ? `<think>${fullReasoning}</think>${fullResponse}`
        : fullResponse;

      if (!combinedText.trim() && !fullReasoning.trim()) {
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            "Modelo retornou texto vazio.",
          ),
        );
      }

      return ok({ text: combinedText });
    } catch (error) {
      console.error("Error during generation:", error);
      if (error instanceof Error && error.name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada pelo usuário."));
      }

      this.parallelStop = null;

      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Falha ao gerar texto.",
          {},
          error as Error,
        ),
      );
    } finally {
      if (options?.abortSignal) {
        options.abortSignal.removeEventListener("abort", this.cancelGeneration);
      }
    }
  }

  /**
   * Cancels an ongoing generation.
   */
  async cancelGeneration(): Promise<void> {
    if (this.parallelStop) {
      await this.parallelStop();
      this.parallelStop = null;
    }
    // Disable parallel mode after cancellation
    if (this.context) {
      await this.context.parallel.disable();
    }
  }

  /**
   * Checks whether a model is loaded.
   */
  isModelLoaded(modelId?: string): boolean {
    if (!this.currentModel) return false;
    if (modelId && this.currentModel.id !== modelId) return false;
    return this.currentModel.isLoaded;
  }

  /**
   * Returns the currently loaded model.
   */
  getCurrentModel(): LoadedModel | null {
    return this.currentModel;
  }
}

/** Returns the singleton instance of AIRuntime */
export function getAIRuntime(): AIRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new AIRuntime();
  }
  return runtimeInstance;
}
