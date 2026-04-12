import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { downloadModel } from "@react-native-ai/llama";
import { Directory, File, Paths } from "expo-file-system";
import DeviceInfo from "react-native-device-info";

/**
 * Diretório onde os modelos GGUF são armazenados.
 * Usa Paths.document (persistente, não é limpo pelo SO).
 */
const MODELS_DIR = new Directory(Paths.document, "models");

// ============================================================================
// Types
// ============================================================================

export interface DownloadProgressInfo {
  modelId: string;
  progress: number;
}

export type OnDownloadProgress = (info: DownloadProgressInfo) => void;

// ============================================================================
// Download
// ============================================================================

/**
 * Garante que o diretório de modelos existe.
 */
function ensureModelsDir(): void {
  if (!MODELS_DIR.exists) {
    MODELS_DIR.create();
  }
}

/**
 * Download de modelo do catálogo usando @react-native-ai/llama.
 *
 * @param modelId - ID lógico do modelo no catálogo
 * @param huggingFaceId - ID HuggingFace ("owner/repo/file.gguf")
 * @param onProgress - Callback de progresso chamado durante o download
 * @returns Result com caminho local do arquivo GGUF
 */
export async function downloadModelById(
  modelId: string,
  huggingFaceId: string,
  onProgress?: OnDownloadProgress,
): Promise<Result<string>> {
  try {
    ensureModelsDir();

    onProgress?.({ modelId, progress: 0 });

    const localPath = await downloadModel(huggingFaceId, (progress) => {
      onProgress?.({ modelId, progress: progress.percentage });
    });

    console.log(`Modelo ${modelId} baixado para ${localPath}`);

    onProgress?.({ modelId, progress: 100 });

    return ok(localPath);
  } catch (error) {
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

// ============================================================================
// Resource Validation
// ============================================================================

/**
 * Verifica se há RAM suficiente para o modelo.
 */
export async function hasEnoughRam(
  estimatedRamBytes: number,
): Promise<Result<boolean>> {
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
export async function hasEnoughDisk(
  requiredBytes: number,
): Promise<Result<boolean>> {
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
export function getDownloadedModels(): Record<string, string> {
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
export function isModelDownloaded(modelId: string): boolean {
  const file = new File(MODELS_DIR, `${modelId}.gguf`);
  return file.exists;
}

/**
 * Retorna o caminho local do modelo, ou null se não existe.
 */
export function getModelLocalPath(modelId: string): string | null {
  const file = new File(MODELS_DIR, `${modelId}.gguf`);
  return file.exists ? file.uri : null;
}

/**
 * Remove modelo do dispositivo (deleta arquivo .gguf).
 */
export function removeDownloadedModel(modelId: string): void {
  const file = new File(MODELS_DIR, `${modelId}.gguf`);
  if (file.exists) {
    file.delete();
  }
}
