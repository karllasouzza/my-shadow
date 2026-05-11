import { initLlama, type ContextParams, type LlamaContext } from "llama.rn";
import { aiDebug, aiError, aiInfo, aiWarn } from "../log";
import { findModelById } from "./catalog";
import { buildContextConfig } from "./config";
import { canRetry, degradeConfig, isOOMError } from "./oom-recovery";
import { runStream } from "./stream";
import { runToolPipeline } from "./tool-execution";
import type {
    CompletionOutput,
    ContextConfig,
    EngineState,
    GenerateOptions,
    LoadedModel,
    Message,
    ModelId,
    Result,
} from "./types";
import { fail, ok } from "./types";

interface InternalState {
  context: LlamaContext | null;
  modelId: ModelId | null;
  config: ContextConfig | null;
  loadingPromise: Promise<Result<LoadedModel>> | null;
  stopFn: (() => Promise<void>) | null;
  isGenerating: boolean;
  isToolUseSupported: boolean;
  isThinkingSupported: boolean;
}

export class TextEngine {
  private state: InternalState = {
    context: null,
    modelId: null,
    config: null,
    loadingPromise: null,
    stopFn: null,
    isGenerating: false,
    isToolUseSupported: false,
    isThinkingSupported: false,
  };

  // ─── Lifecycle Methods ───

  getState(): EngineState {
    return {
      modelId: this.state.modelId,
      isLoaded: this.state.context !== null,
      isGenerating: this.state.isGenerating,
      isToolUseSupported: this.state.isToolUseSupported,
      isThinkingSupported: this.state.isThinkingSupported,
    };
  }

  isReady(): boolean {
    return this.state.context !== null;
  }

  getContext(): LlamaContext | null {
    return this.state.context;
  }

  getConfig(): ContextConfig | null {
    return this.state.config;
  }

  async loadModel(
    modelId: string,
    path: string,
    fileSizeBytes: number,
  ): Promise<Result<LoadedModel>> {
    if (this.state.loadingPromise) {
      return this.state.loadingPromise;
    }

    this.state.loadingPromise = this.doLoad(modelId, path, fileSizeBytes);
    const result = await this.state.loadingPromise;
    this.state.loadingPromise = null;
    return result;
  }

  async unloadModel(): Promise<Result<void>> {
    const start = Date.now();
    aiInfo("UNLOAD:start", `modelId=${this.state.modelId}`);
    try {
      await this.cancel();
      await this.state.context?.parallel?.disable?.().catch(() => {});
      await this.state.context?.release?.().catch(() => {});
      this.resetState();
      const duration = Date.now() - start;
      aiInfo("UNLOAD:done", `duration_ms=${duration}`);
      return ok(undefined);
    } catch (error) {
      const duration = Date.now() - start;
      aiError("UNLOAD:error", `duration_ms=${duration}`, {
        error: (error as Error)?.message,
      });
      return fail("UNKNOWN", "Failed to unload model.", error);
    }
  }

  async cancel(): Promise<void> {
    await this.state.stopFn?.();
    this.state.stopFn = null;
  }

  // ─── Internal helpers for submodules ───

  setGenerating(value: boolean): void {
    this.state.isGenerating = value;
  }

  setStopFn(fn: (() => Promise<void>) | null): void {
    this.state.stopFn = fn;
  }

  // ─── Private Methods ───

  private async doLoad(
    modelId: string,
    path: string,
    fileSizeBytes: number,
    retryCount: number = 0,
  ): Promise<Result<LoadedModel>> {
    const start = Date.now();
    aiInfo("LOAD:start", `modelId=${modelId}`, {
      modelId,
      path,
      fileSizeBytes,
    });

    try {
      await this.unloadModel();

      const config = await buildContextConfig({ fileSizeBytes });
      this.state.config = config;

      console.log(this.toLlamaParams(path, config));
      const context = await initLlama(this.toLlamaParams(path, config));
      console.log(context);

      await context.parallel.enable({ n_parallel: 4 });
      this.state.context = context;
      this.state.modelId = modelId as ModelId;

      this.detectCapabilities(modelId);
      await this.warmup();

      const duration = Date.now() - start;
      aiInfo("LOAD:done", `modelId=${modelId} duration_ms=${duration}`, {
        modelId,
        duration,
        config,
      });

      return ok({
        id: modelId as ModelId,
        config,
        isToolUseSupported: this.state.isToolUseSupported,
        isThinkingSupported: this.state.isThinkingSupported,
      });
    } catch (error) {
      if (isOOMError(error) && canRetry(retryCount)) {
        aiError("LOAD:oom", `retrying with degraded config`, { retryCount });
        const degraded = degradeConfig(this.state.config!);
        this.state.config = degraded;
        return this.doLoadWithConfig(modelId, path, degraded, retryCount + 1);
      }

      const duration = Date.now() - start;
      aiError("LOAD:error", `modelId=${modelId} duration_ms=${duration}`, {
        error: (error as Error)?.message,
      });
      return fail("LOAD_FAILED", "Failed to load model.", error);
    }
  }

  private async doLoadWithConfig(
    modelId: string,
    path: string,
    config: ContextConfig,
    retryCount: number,
  ): Promise<Result<LoadedModel>> {
    const start = Date.now();
    try {
      await this.unloadModel();

      console.log(this.toLlamaParams(path, config));
      const context = await initLlama(this.toLlamaParams(path, config));

      await context.parallel.enable({ n_parallel: 1 });
      this.state.context = context;
      this.state.modelId = modelId as ModelId;
      this.state.config = config;

      this.detectCapabilities(modelId);
      await this.warmup();

      const duration = Date.now() - start;
      aiInfo("LOAD:done", `modelId=${modelId} (degraded) ms=${duration}`);

      return ok({
        id: modelId as ModelId,
        config,
        isToolUseSupported: this.state.isToolUseSupported,
        isThinkingSupported: this.state.isThinkingSupported,
      });
    } catch (error) {
      if (isOOMError(error) && canRetry(retryCount)) {
        const degraded = degradeConfig(config);
        return this.doLoadWithConfig(modelId, path, degraded, retryCount + 1);
      }
      return fail("OOM", "Out of memory after retry.", error);
    }
  }

  private detectCapabilities(modelId: string): void {
    try {
      const jinja = this.state.context?.model?.chatTemplates?.jinja;
      this.state.isToolUseSupported = jinja?.defaultCaps?.tools === true;

      const catalogEntry = findModelById(modelId);
      const metadata = this.state.context?.model?.metadata as
        | Record<string, string>
        | undefined;
      const templateStr = metadata?.["tokenizer.chat_template"] ?? "";
      const hasThinkInTemplate = templateStr.toLowerCase().includes("think");
      this.state.isThinkingSupported =
        hasThinkInTemplate || catalogEntry?.supportsReasoning === true;

      aiInfo("LOAD:capabilities", `modelId=${modelId}`, {
        toolUse: this.state.isToolUseSupported,
        thinking: this.state.isThinkingSupported,
      });
    } catch {
      this.state.isToolUseSupported = false;
      this.state.isThinkingSupported = false;
      aiDebug("LOAD:capabilities:error", "could not detect capabilities");
    }
  }

  private async warmup(): Promise<void> {
    if (!this.state.context) return;
    aiDebug("LOAD:warmup:start", "warming up model");
    const start = Date.now();
    try {
      const { promise } = await this.state.context.parallel.completion(
        {
          messages: [{ role: "user", content: "." }],
          n_predict: 1,
          temperature: 0.0,
        },
        () => {},
      );
      await promise;
      await this.state.context?.clearCache?.();
      aiDebug("LOAD:warmup:done", `duration_ms=${Date.now() - start}`);
    } catch (error) {
      aiDebug("LOAD:warmup:skip", `error=${(error as Error)?.message}`);
    }
  }

  private toLlamaParams(path: string, config: ContextConfig): ContextParams {
    return {
      model: path,
      n_ctx: config.n_ctx,
      n_batch: config.n_batch,
      n_ubatch: config.n_ubatch,
      n_threads: config.n_threads,
      n_gpu_layers: config.n_gpu_layers,
      cache_type_k: config.cache_type_k as ContextParams["cache_type_k"],
      cache_type_v: config.cache_type_v as ContextParams["cache_type_v"],
      use_mmap: config.use_mmap,
      use_mlock: config.use_mlock,
      n_parallel: 4,
      no_extra_bufts: true,
    };
  }

  // ─── Generation Method ───

  async generate(
    messages: readonly Message[],
    options: GenerateOptions,
  ): Promise<Result<CompletionOutput>> {
    if (!this.isReady()) {
      return fail(
        "MODEL_NOT_LOADED",
        "No model loaded. Call loadModel() first.",
      );
    }

    this.state.isGenerating = true;

    try {
      const context = this.state.context!;
      const config = this.state.config!;

      const toolDefs =
        options.tools && this.state.isToolUseSupported
          ? options.tools.map((t) => ({
              type: "function" as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
              },
            }))
          : undefined;

      // If tool calls are enabled, use the pipeline
      if (options.onToolCall && toolDefs) {
        const completionFn = (msgs: readonly Message[]) =>
          runStream(context, msgs, options, config, toolDefs, (stop) => {
            this.state.stopFn = async () => {
              stop();
            };
          });
        return await runToolPipeline(messages, options, completionFn);
      }

      // Simple generation without tools
      return await runStream(
        context,
        messages,
        options,
        config,
        toolDefs,
        (stop) => {
          this.state.stopFn = async () => {
            stop();
          };
        },
      );
    } catch (error) {
      if (isOOMError(error) && this.state.config) {
        aiWarn("ENGINE", "OOM detected during generation, degrading config");
        this.state.config = degradeConfig(this.state.config);
        return fail(
          "OOM",
          "Out of memory during generation. Config degraded for next attempt.",
          error,
        );
      }
      return fail(
        "GENERATION_FAILED",
        "Unexpected error during generation",
        error,
      );
    } finally {
      this.state.isGenerating = false;
      this.state.stopFn = null;
    }
  }

  private resetState(): void {
    this.state.context = null;
    this.state.modelId = null;
    this.state.config = null;
    this.state.stopFn = null;
    this.state.isGenerating = false;
    this.state.isToolUseSupported = false;
    this.state.isThinkingSupported = false;
  }
}
