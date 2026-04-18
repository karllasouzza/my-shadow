import { ChatMessage } from "@/database/chat/types";
import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { initLlama, loadLlamaModelInfo } from "llama.rn";
import { detectDevice, type DeviceInfo } from "../../device";
import { buildConfig } from "./config";
import { STOP_WORDS } from "./constants";
import { isLikelyOOMError } from "./oom-detection";
import { CompletionOutput, StreamCompletionOptions } from "./types";

let instance: AIRuntime | null = null;

export class AIRuntime {
  private context: any = null;
  private modelId: string | null = null;
  private stopFn: (() => Promise<void>) | null = null;
  private loadingPromise: Promise<any> | null = null;
  private config: any = null;
  private device: DeviceInfo | null = null;

  isModelLoaded(id?: string): boolean {
    if (!this.context) return false;
    return id ? this.modelId === id : true;
  }

  getCurrentModel() {
    return this.modelId ? { id: this.modelId, isLoaded: true } : null;
  }

  async loadModel(
    modelId: string,
    path: string,
    fileSizeBytes: number,
  ): Promise<Result<{ id: string }>> {
    // Protection against simultaneous load (SIGSEGV)
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this._doLoad(modelId, path, fileSizeBytes);
    const result = await this.loadingPromise;
    this.loadingPromise = null;
    return result;
  }

  private async _doLoad(
    modelId: string,
    path: string,
    fileSizeBytes: number,
  ): Promise<Result<{ id: string }>> {
    // Just return if the same model is already loaded
    if (this.modelId === modelId && this.context) {
      return ok({ id: modelId });
    }

    await this.unloadModel();

    // Check memory: file * 1.5 for KV cache + activations
    const device = await detectDevice();
    const requiredGB = (fileSizeBytes * 1.5) / 1024 ** 3;
    if (requiredGB > device.availableRAM * 0.6) {
      return err(
        createError(
          "INSUFFICIENT_MEMORY",
          `Modelo precisa de ~${requiredGB.toFixed(1)}GB. Disponível: ${device.availableRAM.toFixed(1)}GB.`,
        ),
      );
    }

    await loadLlamaModelInfo(path);

    const config = buildConfig(device, path);
    const hasGPU = device.hasGPU && device.gpuBackend === "Metal";

    console.log("[AIRuntime] Loading model with config", {
      ...config,
      flash_attn: hasGPU,
      flash_attn_type: hasGPU ? "on" : undefined,
    });

    this.context = await initLlama({
      ...config,
      flash_attn: hasGPU,
      flash_attn_type: hasGPU ? "on" : undefined,
    });

    this.modelId = modelId;
    this.config = config;
    this.device = device;

    return ok({ id: modelId });
  }

  async unloadModel(): Promise<Result<void>> {
    await this.cancelGeneration();
    await this.context?.parallel?.disable?.().catch(() => {});
    this.context = null;
    this.modelId = null;
    this.config = null;
    return ok(undefined);
  }

  async streamCompletion(
    messages: ChatMessage[],
    options?: StreamCompletionOptions,
  ): Promise<Result<CompletionOutput>> {
    if (!this.context || !this.modelId) {
      return err(createError("NOT_READY", "Nenhum modelo carregado."));
    }

    const enableThinking = !!options?.enableThinking;
    const signal = options?.abortSignal;
    const filteredMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.role !== "user" ? { reasoning_content: m.reasoning_content } : {}),
    }));

    let text = "";
    let reasoning = "";
    let inThinkTag = false;
    const abortController = new AbortController();

    if (signal) {
      signal.addEventListener("abort", () => abortController.abort());
    }

    try {
      await this.context.parallel.enable({ n_parallel: 1 });

      const { promise, stop } = await this.context.parallel.completion(
        {
          messages: filteredMessages,
          jinja: true,
          enable_thinking: enableThinking,
          thinking_forced_open: enableThinking,
          n_predict: options?.maxTokens ?? this.config?.n_predict ?? 2048,
          temperature: options?.temperature ?? 0.7,
          stop: STOP_WORDS,
          top_k: this.config?.top_k ?? 40,
          top_p: this.config?.top_p ?? 0.9,
        },
        (_: number, data: any) => {
          if (abortController.signal.aborted) return;

          let token = data.token ?? "";
          const reasoningChunk = data.reasoning_content ?? "";

          if (enableThinking && !reasoningChunk) {
            if (token.includes("<think>")) {
              inThinkTag = true;
              token = token.split("<think>")[1] ?? "";
            }
            if (inThinkTag && token.includes("</think>")) {
              const parts = token.split("</think>");
              reasoning += parts[0];
              token = parts[1] ?? "";
              inThinkTag = false;
            } else if (inThinkTag) {
              reasoning += token;
              token = "";
            }
          }

          if (token) text += token;
          if (reasoningChunk) reasoning += reasoningChunk;

          if (token || reasoningChunk) {
            options?.onStreamChunk?.({
              token,
              reasoning: reasoningChunk || undefined,
            });
          }
        },
      );

      this.stopFn = stop;

      const result = await promise;

      if (abortController.signal.aborted) {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      if (!text.trim() && !reasoning.trim()) {
        return err(createError("EMPTY", "Resposta vazia."));
      }

      return ok({
        text,
        reasoning: reasoning || undefined,
        timings: result.timings,
      });
    } catch (error) {
      if (
        (error as Error).name === "AbortError" ||
        abortController.signal.aborted
      ) {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      // OOM recovery: try degrading the context size and retrying once
      if (isLikelyOOMError(error) && this.config) {
        const degraded = {
          ...this.config,
          n_ctx: Math.floor(this.config.n_ctx / 2),
        };
        this.config = degraded;
        return this.streamCompletion(messages, options);
      }

      return err(
        createError(
          "GENERATION_FAILED",
          "Falha ao gerar texto.",
          {},
          error as Error,
        ),
      );
    } finally {
      this.stopFn = null;
      await this.context?.parallel?.disable?.().catch(() => {});
    }
  }

  async cancelGeneration(): Promise<void> {
    await this.stopFn?.();
    this.stopFn = null;
  }
}

export function getAIRuntime(): AIRuntime {
  return (instance ??= new AIRuntime());
}
