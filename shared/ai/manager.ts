import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { downloadModel } from "@react-native-ai/llama";
import { Directory, File, Paths } from "expo-file-system";
import DeviceInfo from "react-native-device-info";
import type { DownloadState } from "./types";

/**
 * Diretório onde os modelos GGUF são armazenados.
 * Usa Paths.document (persistente, não é limpo pelo SO).
 */
const MODELS_DIR = new Directory(Paths.document, "llm_models");

let managerInstance: ModelManager | null = null;

export class ModelManager {
  private abortController: AbortController | null = null;
  private downloadState: DownloadState = {
    modelId: null,
    progress: 0,
    isActive: false,
  };

  // ============================================================================
  // Download
  // ============================================================================

  /**
   * Download de modelo do catálogo usando @react-native-ai/llama.
   * Retorna o caminho local do arquivo GGUF.
   */
  async downloadModelById(
    modelId: string,
    huggingFaceId: string,
  ): Promise<Result<string>> {
    try {
      this.abortController = new AbortController();

      // Garante que o diretório de modelos existe
      if (!MODELS_DIR.exists) {
        MODELS_DIR.create();
      }

      this.downloadState = {
        modelId,
        progress: 0,
        isActive: true,
      };

      const localPath = await downloadModel(huggingFaceId, (progress) => {
        this.downloadState.progress = progress.percentage;
      });

      this.downloadState.isActive = false;
      this.downloadState.modelId = null;
      this.abortController = null;

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
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.downloadState = {
      modelId: null,
      progress: 0,
      isActive: false,
    };
  }

  // ============================================================================
  // Resource Validation
  // ============================================================================

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
  // Estado Persistido (FileSystem-based)
  // ============================================================================
  // Modelos são detectados diretamente pelo arquivo no dispositivo.
  // Convenção: {MODELS_DIR}/{modelId}.gguf
  // ============================================================================

  /**
   * Retorna mapa de modelos baixados: { modelId: filePath }.
   * Lista arquivos no diretório e filtra por extensão .gguf.
   */
  getDownloadedModels(): Record<string, string> {
    if (!MODELS_DIR.exists) return {};

    const map: Record<string, string> = {};
    const items = MODELS_DIR.list();

    for (const item of items) {
      if (item instanceof File && item.name.endsWith(".gguf")) {
        const modelId = item.name.replace(/\.gguf$/, "");
        map[modelId] = item.uri;
      }
    }

    return map;
  }

  /**
   * Verifica se o modelo existe no dispositivo (checagem real de arquivo).
   */
  isModelDownloaded(modelId: string): boolean {
    const file = new File(MODELS_DIR, `${modelId}.gguf`);
    return file.exists;
  }

  /**
   * Retorna o caminho local do modelo, ou null se não existe.
   */
  getModelLocalPath(modelId: string): string | null {
    const file = new File(MODELS_DIR, `${modelId}.gguf`);
    return file.exists ? file.uri : null;
  }

  /**
   * Remove modelo do dispositivo (deleta arquivo).
   */
  removeDownloadedModel(modelId: string): void {
    const file = new File(MODELS_DIR, `${modelId}.gguf`);
    if (file.exists) {
      file.delete();
    }
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
