import { Result, createError, err, ok } from "@/shared/utils/app-error";
// @ts-ignore
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
  // metadata about the currently loaded model (kept only if needed later)
  private context: LlamaContext | null = null;
  private stopGeneration: (() => Promise<void>) | null = null;

  // ---------------------------------------------------------------------------
  // Model lifecycle
  // ---------------------------------------------------------------------------

  async loadModel(
    modelId: string,
    modelPath: string,
  ): Promise<Result<LoadedModel>> {
    try {
      if (this.context) await this.unloadModel();

      // load model info (kept for side-effects when available)
      await loadLlamaModelInfo(modelPath);
      this.context = await initLlama({
        model: modelPath,
        n_ctx: 4096,
        n_threads: 4,
        n_batch: 512,
        n_gpu_layers: 99,
        use_mlock: true,
        flash_attn_type: "on",
        flash_attn: true,
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

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  /**
   * Streams a completion from the loaded model.
   *
   * Tokens and reasoning chunks are forwarded in real-time via `onStreamChunk`.
   * The returned `CompletionOutput` contains both fields separately — no manual
   * `<think>` tag assembly here; that's the caller's concern.
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

    const enableThinking =
      !!options?.enableThinking &&
      (findModelById(this.currentModel.id)?.supportsReasoning ?? false);

    let fullText = "";
    let fullReasoning = "";

    const signal = options?.abortSignal;
    const onAbort = () => {
      void this.cancelGeneration();
    };

    try {
      await this.context.parallel.enable({ n_parallel: 1 });

      const { promise, stop } = await this.context.parallel.completion(
        {
          messages,
          jinja: true,
          enable_thinking: enableThinking,
          thinking_forced_open: enableThinking,
          n_predict: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          stop: STOP_WORDS,
          dry_penalty_last_n: 64,
        },
        (_requestId: number, data: TokenData) => {
          const token = data.token ?? "";
          const reasoning = data.reasoning_content ?? "";

          if (!token && !reasoning) return;

          fullText += token;
          fullReasoning += reasoning;

          options?.onStreamChunk?.({
            token,
            reasoning: reasoning || undefined,
          });
        },
      );

      this.stopGeneration = stop;

      if (signal) {
        try {
          if (typeof (signal as any).addEventListener === "function") {
            (signal as any).addEventListener("abort", onAbort);
          } else {
            (signal as any).onabort = onAbort;
          }
        } catch (e) {
          console.error("[AIRuntime] streamCompletion abort signal error:", e);
        }
      }

      await promise;

      if (signal?.aborted) {
        return err(createError("ABORTED", "Geração cancelada pelo usuário."));
      }

      if (!fullText.trim() && !fullReasoning.trim()) {
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            "Modelo retornou texto vazio.",
          ),
        );
      }

      return ok({ text: fullText, reasoning: fullReasoning || undefined });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada pelo usuário."));
      }
      console.error("[AIRuntime] streamCompletion error:", error);
      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Falha ao gerar texto.",
          {},
          error as Error,
        ),
      );
    } finally {
      this.stopGeneration = null;
      if (signal) {
        try {
          if (typeof (signal as any).removeEventListener === "function") {
            (signal as any).removeEventListener("abort", onAbort);
          } else {
            (signal as any).onabort = null;
          }
        } catch (e) {
          // ignore
        }
      }
      await this.context?.parallel.disable().catch(() => {});
    }
  }

  async cancelGeneration(): Promise<void> {
    if (this.stopGeneration) {
      await this.stopGeneration();
      this.stopGeneration = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  isModelLoaded(modelId?: string): boolean {
    if (!this.currentModel?.isLoaded) return false;
    return modelId ? this.currentModel.id === modelId : true;
  }

  getCurrentModel(): LoadedModel | null {
    return this.currentModel;
  }
}

export function getAIRuntime(): AIRuntime {
  if (!runtimeInstance) runtimeInstance = new AIRuntime();
  return runtimeInstance;
}
