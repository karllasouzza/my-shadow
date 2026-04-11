/**
 * AI Runtime
 *
 * Runtime simplificado usando @react-native-ai/llama e AI SDK (streamText).
 * Gerencia carregamento de modelo e geração de texto com streaming.
 */

import * as DatabaseModels from "@/database/models";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { llama } from "@react-native-ai/llama";
import { streamText } from "ai";
import type {
  ChatMessage,
  CompletionOutput,
  LoadedModel,
  StreamCompletionOptions,
} from "./types";

// ============================================================================
// Singleton
// ============================================================================

let runtimeInstance: AIRuntime | null = null;

export class AIRuntime {
  private currentModel: LoadedModel | null = null;
  private modelInstance: ReturnType<typeof llama.languageModel> | null = null;
  private abortController: AbortController | null = null;

  /**
   * Carrega modelo na memória.
   * @param modelId - ID lógico do modelo
   * @param modelPath - Caminho local do arquivo GGUF
   */
  async loadModel(
    modelId: string,
    modelPath: string,
  ): Promise<Result<LoadedModel>> {
    try {
      // Se já tem modelo carregado, descarrega primeiro
      if (this.modelInstance) {
        await this.unloadModel();
      }

      // Cria instância do modelo
      this.modelInstance = llama.languageModel(modelPath);

      // Carrega na memória
      await this.modelInstance.prepare();

      this.currentModel = {
        id: modelId,
        isLoaded: true,
      };

      // Persiste modelo ativo
      DatabaseModels.setActiveModelId(modelId);

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

      // Limpa persistência
      DatabaseModels.clearActiveModelId();

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
   * Gera completção com streaming usando AI SDK.
   * Usa AbortController para cancelamento (sem setTimeout!).
   */
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
      // Cria AbortController para cancelamento
      this.abortController = new AbortController();

      // Monta o prompt no formato de chat
      const prompt = this.formatMessages(messages);

      // Usa AI SDK para streaming
      const { textStream } = streamText({
        model: this.modelInstance,
        prompt,
        abortSignal: options?.abortSignal ?? this.abortController.signal,
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
      // AbortError é esperado quando cancelado
      if (error instanceof Error && error.name === "AbortError") {
        return err(createError("ABORTED", "Geração cancelada pelo usuário."));
      }

      return err(
        createError(
          "LOCAL_GENERATION_UNAVAILABLE",
          "Falha ao gerar completção.",
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

  /**
   * Formata mensagens no formato de prompt.
   */
  private formatMessages(messages: ChatMessage[]): string {
    return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
  }
}

/** Retorna instância singleton do AIRuntime */
export function getAIRuntime(): AIRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new AIRuntime();
  }
  return runtimeInstance;
}
