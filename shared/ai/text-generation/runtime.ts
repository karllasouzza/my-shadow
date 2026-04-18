import { ChatMessage } from "@/database/chat/types";
import { aiDebug, aiError, aiInfo } from "@/shared/ai/log";
import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { initLlama, LlamaContext, TokenData } from "llama.rn";
import { detectDevice, type DeviceInfo } from "../../device";
import { buildConfig } from "./config";
import { STOP_WORDS } from "./constants";
import { isLikelyOOMError } from "./oom-detection";
import { CompletionOutput, StreamCompletionOptions } from "./types";

let instance: AIRuntime | null = null;

export class AIRuntime {
  private context: LlamaContext | null = null;
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
    const start = Date.now();
    aiInfo("LOAD:start", `modelId=${modelId}`, {
      modelId,
      path,
      fileSizeBytes,
    });

    try {
      // Just return if the same model is already loaded
      if (this.modelId === modelId && this.context) {
        aiDebug("LOAD:skip", `model already loaded: ${modelId}`);
        return ok({ id: modelId });
      }

      await this.unloadModel();

      // Check memory: file * 1.5 for KV cache + activations
      this.device ??= await detectDevice();
      const device = this.device as DeviceInfo;
      const requiredGB = (fileSizeBytes * 1.5) / 1024 ** 3;
      aiDebug("LOAD:device-check", `requiredGB=${requiredGB.toFixed(2)}`, {
        requiredGB,
        device,
      });
      if (requiredGB > device.availableRAM * 0.75) {
        const message = `Modelo precisa de ~${requiredGB.toFixed(1)}GB. Disponível: ${device.availableRAM.toFixed(1)}GB.`;
        aiError("LOAD:insufficient-memory", message, {
          requiredGB,
          availableRAM: device.availableRAM,
        });
        return err(createError("INSUFFICIENT_MEMORY", message));
      }

      const config = buildConfig(device, path);
      const hasGPU = device.hasGPU;

      // Flash attention overhead may exceed benefits for small models (< 500MB)
      const enableFlashAttn = hasGPU && fileSizeBytes > 500_000_000;

      aiInfo("LOAD:initLlama:start", `modelId=${modelId}`, {
        config: { ...config, model: undefined },
        hasGPU,
        flashAttention: enableFlashAttn,
      });

      this.context = await initLlama({
        ...config,
        flash_attn: enableFlashAttn,
        flash_attn_type: enableFlashAttn ? "on" : "auto",
      });

      await this.context.parallel.enable({ n_parallel: 1 });

      this.modelId = modelId;
      this.config = config;

      // Warm up the model to reduce TTFT on first inference
      // This does a single token completion to initialize caches and JIT compilation
      await this._warmupModel().catch((err: unknown) => {
        aiDebug("LOAD:warmup:skip", `error=${(err as Error)?.message}`);
      });

      const duration = Date.now() - start;
      aiInfo("LOAD:done", `modelId=${modelId} duration_ms=${duration}`, {
        modelId,
        duration,
        config,
        device,
      });

      return ok({ id: modelId });
    } catch (error) {
      const duration = Date.now() - start;
      aiError("LOAD:error", `modelId=${modelId} duration_ms=${duration}`, {
        modelId,
        duration,
        error: (error as Error)?.message,
      });
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Falha ao carregar modelo.",
          {},
          error as Error,
        ),
      );
    }
  }

  async unloadModel(): Promise<Result<void>> {
    const start = Date.now();
    aiInfo("UNLOAD:start", `modelId=${this.modelId}`);
    try {
      await this.cancelGeneration();
      await this.context?.parallel?.disable?.().catch(() => {});
      await this.context?.release?.().catch(() => {});
      this.context = null;
      this.modelId = null;
      this.config = null;
      const duration = Date.now() - start;
      aiInfo("UNLOAD:done", `duration_ms=${duration}`);
      return ok(undefined);
    } catch (error) {
      const duration = Date.now() - start;
      aiError("UNLOAD:error", `duration_ms=${duration}`, {
        error: (error as Error)?.message,
      });
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Falha ao descarregar modelo.",
          {},
          error as Error,
        ),
      );
    }
  }

  private async _warmupModel(): Promise<void> {
    if (!this.context) return;
    aiDebug("LOAD:warmup:start", "warming up model");
    const start = Date.now();
    try {
      const { promise } = await this.context.parallel.completion(
        {
          messages: [{ role: "user", content: "Hi" }],
          n_predict: 1,
          temperature: 0.0,
        },
        () => {},
      );
      await promise;
      const duration = Date.now() - start;
      aiDebug("LOAD:warmup:done", `duration_ms=${duration}`);
    } catch (error) {
      aiDebug("LOAD:warmup:error", `${(error as Error)?.message}`);
      throw error;
    }
  }

  async streamCompletion(
    messages: ChatMessage[],
    options?: StreamCompletionOptions,
    _retryCount = 0,
  ): Promise<Result<CompletionOutput>> {
    if (!this.context || !this.modelId) {
      return err(createError("NOT_READY", "Nenhum modelo carregado."));
    }

    const enableThinking = !!options?.enableThinking;
    // Disable thinking mode for very small models (< 800MB) as overhead may exceed benefits
    const actualEnableThinking =
      enableThinking &&
      this.config &&
      (this.config.model?.includes?.("7b") ||
        this.config.model?.includes?.("13b") ||
        this.config.model?.includes?.("70b"));
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

    const inferenceStart = Date.now();
    aiInfo("INFERENCE:start", `modelId=${this.modelId}`, {
      modelId: this.modelId,
      messageCount: messages.length,
    });

    let firstTokenAt: number | null = null;

    try {
      const { promise, stop } = await this.context.parallel.completion(
        {
          messages: filteredMessages,
          jinja: true,
          enable_thinking: actualEnableThinking,
          thinking_forced_open: actualEnableThinking,
          n_predict: options?.maxTokens ?? this.config?.n_predict ?? 2048,
          temperature: options?.temperature ?? 0.7,
          stop: STOP_WORDS,
          top_k: this.config?.top_k ?? 40,
          top_p: this.config?.top_p ?? 0.9,
          penalty_freq: 0.5,
          penalty_last_n: 64,
        },
        (_: number, data: TokenData) => {
          if (abortController.signal.aborted) return;

          let token = data.token ?? "";
          const reasoningChunk = data.reasoning_content ?? "";
          let reasoningToSend = "";

          // capture first token time-to-first-token
          if (!firstTokenAt && (token || reasoningChunk)) {
            firstTokenAt = Date.now();
            const ttf = firstTokenAt - inferenceStart;
            aiInfo(
              "INFERENCE:first-token",
              `modelId=${this.modelId} ttf_ms=${ttf}`,
              { ttf_ms: ttf, preview: (token || reasoningChunk).slice(0, 8) },
            );
          }

          if (enableThinking && !reasoningChunk) {
            if (token.includes("<think>")) {
              inThinkTag = true;
              token = token.split("<think>")[1] ?? "";
            }
            if (inThinkTag && token.includes("</think>")) {
              const parts = token.split("</think>");
              reasoningToSend = parts[0];
              reasoning += reasoningToSend;
              token = parts[1] ?? "";
              inThinkTag = false;
            } else if (inThinkTag) {
              reasoningToSend = token;
              reasoning += token;
              token = "";
            }
          }

          if (token) text += token;
          if (reasoningChunk) reasoning += reasoningChunk;

          if (token || reasoningChunk || reasoningToSend) {
            options?.onStreamChunk?.({
              token,
              reasoning: reasoningChunk || reasoningToSend || undefined,
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

      const duration = Date.now() - inferenceStart;
      aiInfo(
        "INFERENCE:end",
        `modelId=${this.modelId} duration_ms=${duration}`,
        { duration_ms: duration, timings: result.timings },
      );

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

      // OOM recovery: degrade context size and retry once
      if (isLikelyOOMError(error) && this.config && _retryCount < 1) {
        const degraded = {
          ...this.config,
          n_ctx: Math.floor(this.config.n_ctx / 2),
        };
        this.config = degraded;
        return this.streamCompletion(messages, options, _retryCount + 1);
      }

      aiError(
        "INFERENCE:error",
        `modelId=${this.modelId} error=${(error as Error)?.message}`,
        { error: (error as Error)?.message },
      );
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
    }
  }

  async cancelGeneration(): Promise<void> {
    aiInfo("INFERENCE:cancel", `modelId=${this.modelId}`);
    await this.stopFn?.();
    this.stopFn = null;
  }
}

export function getAIRuntime(): AIRuntime {
  return (instance ??= new AIRuntime());
}
