/**
 * Model Manager
 *
 * Gerencia download, carregamento e descarregamento de modelos
 * usando @react-native-ai/llama com API simplificada.
 */

import * as DatabaseModels from "@/database/models";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { downloadModel } from "@react-native-ai/llama";
import DeviceInfo from "react-native-device-info";
import type { DownloadState } from "./types";

// ============================================================================
// Singleton
// ============================================================================

let managerInstance: ModelManager | null = null;

export class ModelManager {
  private downloadState: DownloadState = {
    modelId: null,
    progress: 0,
    isActive: false,
  };

  /**
   * Download de modelo do catálogo usando @react-native-ai/llama.
   * Retorna o caminho local do arquivo GGUF.
   */
  async downloadModel(
    modelId: string,
    huggingFaceId: string,
  ): Promise<Result<string>> {
    try {
      this.downloadState = {
        modelId,
        progress: 0,
        isActive: true,
      };

      // @react-native-ai/llama retorna o caminho local automaticamente
      const localPath = await downloadModel(huggingFaceId);

      // Persiste o caminho
      DatabaseModels.setDownloadedModelPath(modelId, localPath);

      this.downloadState = {
        modelId: null,
        progress: 100,
        isActive: false,
      };

      return ok(localPath);
    } catch (error) {
      this.downloadState = {
        modelId: null,
        progress: 0,
        isActive: false,
      };

      return err(
        createError(
          "STORAGE_ERROR",
          "Falha ao baixar o modelo. Verifique sua conexão com a internet.",
          { modelId, huggingFaceId },
          error as Error,
        ),
      );
    }
  }

  /**
   * Cancela download ativo.
   */
  cancelDownload(): void {
    // @react-native-ai/llama gerencia cancelamento internamente
    // TODO: implementar cancelamento quando suportado
    this.downloadState = {
      modelId: null,
      progress: 0,
      isActive: false,
    };
  }

  /**
   * Verifica se há RAM suficiente para o modelo.
   */
  async hasEnoughRam(estimatedRamBytes: number): Promise<Result<boolean>> {
    try {
      const totalRam = await DeviceInfo.getTotalMemory();
      if (totalRam < estimatedRamBytes) {
        return err(
          createError(
            "VALIDATION_ERROR",
            `RAM insuficiente: ${Math.round(totalRam / 1024 / 1024)}MB disponível, ${Math.round(estimatedRamBytes / 1024 / 1024)}MB necessário.`,
            { availableRam: totalRam, requiredRam: estimatedRamBytes },
          ),
        );
      }
      return ok(true);
    } catch (error) {
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Não foi possível verificar a RAM do dispositivo.",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Verifica se há espaço em disco suficiente.
   */
  async hasEnoughDisk(requiredBytes: number): Promise<Result<boolean>> {
    try {
      // @react-native-ai/llama gerencia espaço automaticamente
      // Apenas verificamos se temos pelo menos o dobro do tamanho como margem
      const freeDisk = await DeviceInfo.getFreeDiskStorage("important");
      return ok(freeDisk > requiredBytes * 2);
    } catch (error) {
      return err(
        createError(
          "UNKNOWN_ERROR",
          "Não foi possível verificar o espaço em disco.",
          {},
          error as Error,
        ),
      );
    }
  }

  // ============================================================================
  // Estado Persistido (delegado para database/models.ts)
  // ============================================================================

  setActiveModel(modelId: string): void {
    DatabaseModels.setActiveModelId(modelId);
  }

  clearActiveModel(): void {
    DatabaseModels.clearActiveModelId();
  }

  getActiveModel(): string | null {
    return DatabaseModels.getActiveModelId();
  }

  getDownloadedModels(): Record<string, string> {
    return DatabaseModels.getDownloadedModelMap();
  }

  isModelDownloaded(modelId: string): boolean {
    return DatabaseModels.isModelDownloaded(modelId);
  }

  getModelLocalPath(modelId: string): string | null {
    return DatabaseModels.getModelLocalPath(modelId);
  }

  setDownloadedModelPath(modelId: string, localPath: string): void {
    DatabaseModels.setDownloadedModelPath(modelId, localPath);
  }

  removeDownloadedModel(modelId: string): void {
    DatabaseModels.removeDownloadedModel(modelId);
  }

  // ============================================================================
  // Download State
  // ============================================================================

  getDownloadProgress(): number {
    return this.downloadState.progress;
  }

  isDownloadActive(): boolean {
    return this.downloadState.isActive;
  }

  getDownloadingModelId(): string | null {
    return this.downloadState.modelId;
  }
}

/** Retorna instância singleton do ModelManager */
export function getModelManager(): ModelManager {
  if (!managerInstance) {
    managerInstance = new ModelManager();
  }
  return managerInstance;
}
