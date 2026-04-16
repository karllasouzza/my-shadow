import { detectDevice } from "@/shared/device";
import type { DeviceInfo, RuntimeConfig } from "@/shared/device/types";
import { createError, err, ok, Result } from "@/shared/utils/app-error";
import { initLlama, LlamaContext, loadLlamaModelInfo } from "llama.rn";
import { findModelById } from "./catalog";
import { MemoryMonitor } from "./memory-monitor";
import { isLikelyOOMError } from "./oom-detection";
import { RuntimeConfigGenerator } from "./runtime-config-generator";
import type { ChatMessage } from "./types/chat";
import type {
  CompletionOutput,
  LoadedModel,
  StreamCompletionOptions,
} from "./types/runtime";
import { STOP_WORDS } from "./utils/constants";

let instance: AIRuntime | null = null;

export class AIRuntime {
  private model: LoadedModel | null = null;
  private context: LlamaContext | null = null;
  private stop: (() => Promise<void>) | null = null;
  private readonly configGenerator = new RuntimeConfigGenerator();
  private readonly memoryMonitor = new MemoryMonitor();
  private lastModelPath: string | null = null;
  private lastRuntimeConfig: RuntimeConfig | null = null;

  async initializeAdaptiveRuntime(): Promise<void> {
    const pressure = await this.memoryMonitor.evaluate();
    if (pressure.availableRAM / 1024 ** 3 < 1.5) {
      console.warn("[AIRuntime] Insufficient RAM for local inference");
    }
  }

  async loadModel(
    modelId: string,
    path: string,
    optionalOverrideConfig?: Partial<RuntimeConfig>,
  ): Promise<Result<LoadedModel>> {
    try {
      await this.unloadModel();
      await loadLlamaModelInfo(path);

      const { runtimeConfig, deviceInfo } = await this.buildAdaptiveConfig(
        path,
        optionalOverrideConfig,
      );

      const hasGPU = deviceInfo.hasGPU && deviceInfo.gpuBackend !== null;
      this.context = await initLlama({
        ...runtimeConfig,
        flash_attn: hasGPU,
        flash_attn_type: deviceInfo.gpuBackend === "metal" ? "on" : "auto",
      });

      this.lastModelPath = path;
      this.lastRuntimeConfig = runtimeConfig;
      this.model = { id: modelId, isLoaded: true };

      void this.warmUp();

      return ok(this.model);
    } catch (error) {
      this.model = null;
      this.context = null;
      return err(
        createError(
          "NOT_READY",
          "Falha ao carregar modelo.",
          { modelId, path },
          error as Error,
        ),
      );
    }
  }

  async unloadModel(): Promise<Result<void>> {
    if (!this.context) return ok(undefined);

    await this.cancelGeneration();
    await this.context.parallel.disable().catch(() => {});
    this.context = null;
    this.model = null;
    return ok(undefined);
  }

  async streamCompletion(
    messages: ChatMessage[],
    options?: StreamCompletionOptions,
  ): Promise<Result<CompletionOutput>> {
    if (!this.context || !this.model) {
      return err(createError("NOT_READY", "Nenhum modelo carregado."));
    }

    const enableThinking =
      !!options?.enableThinking &&
      (findModelById(this.model.id)?.supportsReasoning ?? false);

    let text = "";
    let reasoning = "";
    let isInThinkTag = false;
    let pendingTagBuffer = "";
    const signal = options?.abortSignal;

    const getTrailingPartialTagLength = (source: string, tag: string) => {
      const maxLength = Math.min(source.length, tag.length - 1);

      for (let length = maxLength; length > 0; length -= 1) {
        if (source.endsWith(tag.slice(0, length))) {
          return length;
        }
      }

      return 0;
    };

    const consumeTokenChunk = (
      rawToken: string,
      captureInlineReasoning: boolean,
    ) => {
      let outputToken = "";
      let outputReasoning = "";

      const combined = `${pendingTagBuffer}${rawToken}`;
      pendingTagBuffer = "";

      let cursor = 0;

      while (cursor < combined.length) {
        if (!isInThinkTag) {
          const thinkStart = combined.indexOf("<think>", cursor);

          if (thinkStart === -1) {
            const tail = combined.slice(cursor);
            const partialTagLength = getTrailingPartialTagLength(
              tail,
              "<think>",
            );

            if (partialTagLength > 0) {
              outputToken += tail.slice(0, tail.length - partialTagLength);
              pendingTagBuffer = tail.slice(tail.length - partialTagLength);
            } else {
              outputToken += tail;
            }

            break;
          }

          outputToken += combined.slice(cursor, thinkStart);
          cursor = thinkStart + "<think>".length;
          isInThinkTag = true;
          continue;
        }

        const thinkEnd = combined.indexOf("</think>", cursor);

        if (thinkEnd === -1) {
          const tail = combined.slice(cursor);
          const partialTagLength = getTrailingPartialTagLength(
            tail,
            "</think>",
          );
          const reasoningTail =
            partialTagLength > 0
              ? tail.slice(0, tail.length - partialTagLength)
              : tail;

          if (captureInlineReasoning && reasoningTail) {
            outputReasoning += reasoningTail;
          }

          pendingTagBuffer =
            partialTagLength > 0
              ? tail.slice(tail.length - partialTagLength)
              : "";
          break;
        }

        const reasoningSegment = combined.slice(cursor, thinkEnd);
        if (captureInlineReasoning && reasoningSegment) {
          outputReasoning += reasoningSegment;
        }

        cursor = thinkEnd + "</think>".length;
        isInThinkTag = false;
      }

      return {
        token: outputToken,
        reasoning: outputReasoning,
      };
    };

    try {
      await this.context.parallel.enable({ n_parallel: 1 });

      const { promise, stop } = await this.context.parallel.completion(
        {
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            ...(msg.role !== "user" && msg.reasoning_content
              ? { reasoning_content: msg.reasoning_content }
              : {}),
          })),
          jinja: true,
          enable_thinking: enableThinking,
          thinking_forced_open: enableThinking,
          // n_predict:
          //   options?.maxTokens ?? this.lastRuntimeConfig?.n_predict ?? 2048,
          temperature: options?.temperature ?? 0.7,
          // stop: STOP_WORDS,
          top_k: this.lastRuntimeConfig?.top_k ?? 40,
          top_p: this.lastRuntimeConfig?.top_p ?? 0.9,
          min_p: this.lastRuntimeConfig?.min_p ?? 0.05,
          dry_penalty_last_n: this.lastRuntimeConfig?.dry_penalty_last_n ?? 64,
        },
        (_: number, data: any) => {
          const rawToken = data.token ?? "";
          const nativeReasoningChunk = data.reasoning_content ?? "";

          if (!rawToken && !nativeReasoningChunk) {
            return;
          }

          const parsedToken = consumeTokenChunk(
            rawToken,
            !nativeReasoningChunk,
          );
          const outputToken = parsedToken.token;
          const outputReasoning = `${parsedToken.reasoning}${nativeReasoningChunk}`;

          if (outputToken) {
            text += outputToken;
          }

          if (outputReasoning) {
            reasoning += outputReasoning;
          }

          if (outputToken || outputReasoning) {
            options?.onStreamChunk?.({
              token: outputToken,
              reasoning: outputReasoning || undefined,
            });
          }
        },
      );

      this.stop = stop;
      this.bindAbort(signal);

      const result = await promise;

      if (signal?.aborted) {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      if (pendingTagBuffer && !isInThinkTag) {
        text += pendingTagBuffer;
      }
      pendingTagBuffer = "";

      if (result.text && !text) {
        text = result.text;
      }

      const resultReasoning =
        (result as any).reasoning_content ?? (result as any).reasoning;
      if (!reasoning && resultReasoning) {
        reasoning = String(resultReasoning);
      }

      if (!reasoning && text.includes("<think>")) {
        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          reasoning = thinkMatch[1];
          text = text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
        }
      }

      if (!text.trim() && !reasoning.trim()) {
        return err(
          createError("LOCAL_GENERATION_UNAVAILABLE", "Resposta vazia."),
        );
      }

      return ok({
        text,
        reasoning: reasoning || undefined,
        timings: result.timings,
      });
    } catch (error) {
      console.log("[AIRuntime] Erro durante geração:", error);
      if ((error as Error).name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      const isOOM = isLikelyOOMError(error);
      const pressure = await this.memoryMonitor.evaluate().catch(() => null);

      if (
        isOOM &&
        pressure?.criticalLevel &&
        this.lastModelPath &&
        this.model
      ) {
        const degradedConfig: Partial<RuntimeConfig> = {
          n_ctx: Math.floor((this.lastRuntimeConfig?.n_ctx ?? 4096) / 2),
        };

        await this.loadModel(this.model.id, this.lastModelPath, degradedConfig);
        return this.streamCompletion(messages, options);
      }

      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Falha ao gerar texto.",
          {},
          error as Error,
        ),
      );
    } finally {
      this.stop = null;
      this.unbindAbort(signal);
      await this.context?.parallel.disable().catch(() => {});
    }
  }

  async cancelGeneration(): Promise<void> {
    await this.stop?.();
    this.stop = null;
  }

  isModelLoaded(id?: string): boolean {
    if (!this.model?.isLoaded) return false;
    return id ? this.model.id === id : true;
  }

  getCurrentModel(): LoadedModel | null {
    return this.model;
  }

  private bindAbort(signal?: AbortSignal): void {
    if (!signal) return;
    signal.addEventListener?.("abort", () => this.cancelGeneration());
  }

  private unbindAbort(signal?: AbortSignal): void {
    if (!signal) return;
    signal.removeEventListener?.("abort", () => this.cancelGeneration());
  }

  private async buildAdaptiveConfig(
    modelPath: string,
    overrides?: Partial<RuntimeConfig>,
  ): Promise<{ runtimeConfig: RuntimeConfig; deviceInfo: DeviceInfo }> {
    const deviceInfo = await detectDevice();
    const runtimeConfig = this.configGenerator.generateRuntimeConfig(
      deviceInfo,
      modelPath,
      overrides,
    );

    this.memoryMonitor.configure({
      n_batch: runtimeConfig.n_batch,
      n_ctx: runtimeConfig.n_ctx,
    });

    return { runtimeConfig, deviceInfo };
  }

  private async warmUp(): Promise<void> {
    if (!this.context) return;
    try {
      const { stop, promise } = await this.context.parallel.completion(
        {
          messages: [{ role: "user", content: "." }],
          n_predict: 1,
          stop: STOP_WORDS,
        },
        () => {},
      );
      await stop();
      await promise.catch(() => {});
    } catch {}
  }
}

export function getAIRuntime(): AIRuntime {
  return (instance ??= new AIRuntime());
}
