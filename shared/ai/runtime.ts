import type { RuntimeConfig } from "@/shared/types/device";
import { createError, err, ok, Result } from "@/shared/utils/app-error";
// @ts-ignore
import type {
  LlamaContext,
  RNLlamaOAICompatibleMessage,
  TokenData,
} from "llama.rn";
import { initLlama, loadLlamaModelInfo } from "llama.rn";
import { findModelById } from "./catalog";
import { DeviceDetector } from "./device-detector";
import { MemoryMonitor } from "./memory-monitor";
import { calculateMetrics, GenerationMetrics } from "./metrics";
import { isLikelyOOMError } from "./oom-detection";
import { RuntimeConfigGenerator } from "./runtime-config-generator";
import type { ChatMessage } from "./types/chat";
import type {
  CompletionOutput,
  LoadedModel,
  StreamCompletionOptions,
} from "./types/runtime";

let instance: AIRuntime | null = null;

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
];

const INSUFFICIENT_RAM_GB = 1.5;

export class AIRuntime {
  private model: LoadedModel | null = null;
  private context: LlamaContext | null = null;
  private stop: (() => Promise<void>) | null = null;
  private readonly deviceDetector = new DeviceDetector();
  private readonly configGenerator = new RuntimeConfigGenerator();
  private readonly memoryMonitor = new MemoryMonitor();
  private lastModelPath: string | null = null;
  private lastRuntimeConfig: RuntimeConfig | null = null;

  // ── Startup ──────────────────────────────────────────────────────────────

  async initializeAdaptiveRuntime(): Promise<void> {
    const pressure = await this.memoryMonitor.evaluate();
    if (pressure.availableRAM / 1024 ** 3 < INSUFFICIENT_RAM_GB) {
      console.warn("[AIRuntime] Insufficient RAM for local inference");
    }
  }

  // ── Model loading: detect → classify → generate → load ───────────────────

  async loadModel(
    modelId: string,
    path: string,
    optionalOverrideConfig?: Partial<RuntimeConfig>,
  ): Promise<Result<LoadedModel>> {
    try {
      await this.unloadModel();
      await loadLlamaModelInfo(path);

      const runtimeConfig = await this.buildAdaptiveConfig(
        path,
        optionalOverrideConfig,
      );
      this.context = await initLlama({
        ...runtimeConfig,
        flash_attn_type: "on",
        flash_attn: true,
      });

      this.lastModelPath = path;
      this.lastRuntimeConfig = runtimeConfig;
      this.model = { id: modelId, isLoaded: true };
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
    let tokenCount = 0;
    let firstTokenTime: number | null = null;
    const messagesForContext = this.sanitizeMessagesForLLMContext(messages);
    const startTime = performance.now();

    const signal = options?.abortSignal;
    const onAbort = () => void this.cancelGeneration();

    try {
      await this.context.parallel.enable({ n_parallel: 1 });

      const { promise, stop } = await this.context.parallel.completion(
        {
          messages: messagesForContext,
          jinja: true,
          enable_thinking: enableThinking,
          thinking_forced_open: enableThinking,
          n_predict: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          stop: STOP_WORDS,
          dry_penalty_last_n: 64,
        },
        (_: number, data: TokenData) => {
          const t = data.token ?? "";
          const r = data.reasoning_content ?? "";
          if (!t && !r) return;

          if (firstTokenTime === null) firstTokenTime = performance.now();

          // Count tokens from the regular token stream
          if (t) tokenCount++;

          // Heuristic: estimate tokens coming from reasoning_content by splitting on whitespace
          if (r) {
            const reasoningTokenCount = r.trim()
              ? r.trim().split(/\s+/).filter(Boolean).length
              : 0;
            tokenCount += reasoningTokenCount;
          }

          text += t;
          reasoning += r;
          options?.onStreamChunk?.({ token: t, reasoning: r || undefined });
        },
      );

      this.stop = stop;
      this.bindAbort(signal, onAbort);
      await promise;

      if (signal?.aborted) {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      if (!text.trim() && !reasoning.trim()) {
        return err(
          createError("LOCAL_GENERATION_UNAVAILABLE", "Resposta vazia."),
        );
      }

      const metrics = calculateMetrics(
        startTime,
        firstTokenTime,
        performance.now(),
        tokenCount,
      );

      return ok({ text, reasoning: reasoning || undefined, metrics });
    } catch (error) {
      console.error("Erro durante geração local:", error);
      if ((error as Error).name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada."));
      }

      // Only attempt the automatic degraded-config reload when the failure
      // appears to be an out-of-memory condition coming from llama.rn.
      // Otherwise return the original error to avoid masking non-OOM failures.
      const isOOM = isLikelyOOMError(error);
      const pressure = await this.memoryMonitor.evaluate().catch(() => null);

      if (
        isOOM &&
        pressure?.criticalLevel &&
        this.lastModelPath &&
        this.lastRuntimeConfig &&
        this.model
      ) {
        const modelId = this.model.id;
        const path = this.lastModelPath;
        const degradedConfig: Partial<RuntimeConfig> = {
          n_ctx: Math.floor(this.lastRuntimeConfig.n_ctx / 2),
        };

        console.warn(
          `[AIRuntime] OOM detected and memory critical (${pressure.utilizationPercent}%). Reloading with degraded config (n_ctx=${degradedConfig.n_ctx}).`,
        );

        const reloadResult = await this.loadModel(
          modelId,
          path,
          degradedConfig,
        );
        if (reloadResult.success) {
          return this.streamCompletion(messages, options);
        }

        const safeCtx = pressure.recommendedMaxContext;
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            `Memória insuficiente. Tente novamente com contexto < ${safeCtx} tokens.`,
          ),
        );
      }

      // If it was not an OOM (or memory isn't critical), preserve the original error.
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
      this.unbindAbort(signal, onAbort);
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

  private bindAbort(
    signal: AbortSignal | undefined,
    handler: () => void,
  ): void {
    if (!signal) return;
    try {
      signal.addEventListener?.("abort", handler) ?? (signal.onabort = handler);
    } catch {
      // ignore
    }
  }

  private unbindAbort(
    signal: AbortSignal | undefined,
    handler: () => void,
  ): void {
    if (!signal) return;
    try {
      signal.removeEventListener?.("abort", handler) ?? (signal.onabort = null);
    } catch {
      // ignore
    }
  }

  

  private sanitizeMessagesForLLMContext(
    messages: ChatMessage[],
  ): RNLlamaOAICompatibleMessage[] {
    return messages.map((msg) => {
      const { role, content, reasoning_content } = msg;
      if (role === "user") {
        return {
          role,
          content,
        } as RNLlamaOAICompatibleMessage;
      }
      return {
        role,
        content,
        reasoning_content,
      } as RNLlamaOAICompatibleMessage;
    });
  }

  // ── Adaptive config pipeline ──────────────────────────────────────────────

  private async buildAdaptiveConfig(
    modelPath: string,
    overrides?: Partial<RuntimeConfig>,
  ): Promise<RuntimeConfig> {
    // Step 1: detect device capabilities (RAM, CPU, GPU)
    const deviceInfo = await this.deviceDetector.detect();

    // Step 2: classify device tier and generate optimised config
    const profile = this.configGenerator.selectDeviceProfile(deviceInfo);
    console.log("[AIRuntime] Selected tier:", profile.tier);

    // Step 3: merge with any caller-supplied overrides
    const runtimeConfig = this.configGenerator.generateRuntimeConfig(
      deviceInfo,
      modelPath,
      overrides,
    );

    // Step 4: wire memory monitor to the resolved config
    this.memoryMonitor.configure({
      n_batch: runtimeConfig.n_batch,
      n_ctx: runtimeConfig.n_ctx,
    });

    return runtimeConfig;
  }
}

export function getAIRuntime(): AIRuntime {
  return (instance ??= new AIRuntime());
}

export type { GenerationMetrics };
