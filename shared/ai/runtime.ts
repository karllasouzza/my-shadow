import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { llama } from "@react-native-ai/llama";
import { streamText } from "ai";
import type {
  ChatMessage,
  CompletionOutput,
  LoadedModel,
  StreamCompletionOptions,
} from "./types";

let runtimeInstance: AIRuntime | null = null;

export class AIRuntime {
  private currentModel: LoadedModel | null = null;
  private modelInstance: ReturnType<typeof llama.languageModel> | null = null;
  private abortController: AbortController | null = null;
  private readonly STOP_WORDS = [
    "</s>",
    "<|end|>",
    "<|eot_id|>",
    "<|end_of_text|>",
    "<|im_end|>",
    "<|EOT|>",
    "<|END_OF_TURN_TOKEN|>",
    "<|end_of_turn|>",
    "<|endoftext|>",
  ];

  /**
   * Carrega modelo na memória. Se outro modelo já estiver carregado, ele será descarregado primeiro.
   * @param modelId - ID lógico do modelo
   * @param modelPath - Caminho local do arquivo GGUF
   */
  async loadModel(
    modelId: string,
    modelPath: string,
  ): Promise<Result<LoadedModel>> {
    try {
      if (this.modelInstance) {
        await this.unloadModel();
      }
      this.modelInstance = llama.languageModel(modelPath, {
        contextParams: {
          n_ctx: 2048,
          ctx_shift: true,
          kv_unified: true,
          n_gpu_layers: 99,
          use_mlock: true,
          swa_full: true,
        },
      });

      await this.modelInstance.prepare();

      this.currentModel = {
        id: modelId,
        isLoaded: true,
      };

      return ok(this.currentModel);
    } catch (error) {
      this.currentModel = null;
      this.modelInstance = null;

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
   * Descarrega modelo da memória, liberando RAM.
   */
  async unloadModel(): Promise<Result<void>> {
    try {
      if (!this.modelInstance) {
        return ok(undefined);
      }

      // Cancela geração ativa se houver
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }

      await this.modelInstance.unload();
      this.modelInstance = null;
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

  async streamCompletion(
    messages: ChatMessage[],
    options?: StreamCompletionOptions,
  ): Promise<Result<CompletionOutput>> {
    if (!this.modelInstance || !this.currentModel) {
      return err(
        createError(
          "NOT_READY",
          "Nenhum modelo carregado. Carregue um modelo antes de gerar texto.",
        ),
      );
    }

    try {
      this.abortController = new AbortController();

      const { textStream } = streamText({
        model: this.modelInstance,
        messages,
        abortSignal: options?.abortSignal ?? this.abortController.signal,
        maxOutputTokens: options?.maxTokens || 2048,
        temperature: options?.temperature || 0.7,
        stopSequences: this.STOP_WORDS,
        maxRetries: 3,
        presencePenalty: 0.5,
      });

      let fullText = "";

      // Itera sobre chunks de streaming
      for await (const delta of textStream) {
        fullText += delta;
        options?.onToken?.(delta);
      }

      this.abortController = null;

      if (!fullText.trim()) {
        return err(
          createError(
            "LOCAL_GENERATION_UNAVAILABLE",
            "Modelo retornou texto vazio.",
          ),
        );
      }

      return ok({ text: fullText });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada pelo usuário."));
      }

      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Falha ao gerar texto.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Cancela geração em andamento.
   */
  cancelGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Verifica se modelo está carregado.
   */
  isModelLoaded(modelId?: string): boolean {
    if (!this.currentModel) return false;
    if (modelId && this.currentModel.id !== modelId) return false;
    return this.currentModel.isLoaded;
  }

  /**
   * Retorna modelo carregado atualmente.
   */
  getCurrentModel(): LoadedModel | null {
    return this.currentModel;
  }
}

/** Retorna instância singleton do AIRuntime */
export function getAIRuntime(): AIRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new AIRuntime();
  }
  return runtimeInstance;
}
