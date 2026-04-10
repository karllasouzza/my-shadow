import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { DownloadedFile, ResumableRef } from "./types";

export interface DownloadFileOptions {
  url: string;
  destinationUri: string;
  onProgress?: (progress: number) => void;
  resumableRef: ResumableRef;
}

function clampProgress(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function isCancelledDownloadError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return message.includes("cancel") || message.includes("abort");
}

async function removeFileIfExists(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function ensureDirectoryExists(
  directoryUri: string,
): Promise<Result<void>> {
  try {
    const info = await FileSystem.getInfoAsync(directoryUri);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
    }

    return ok(void 0);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao preparar diretorio de modelos.",
        { directoryUri },
        error as Error,
      ),
    );
  }
}

export async function downloadFileAtomically(
  options: DownloadFileOptions,
): Promise<Result<DownloadedFile>> {
  const partialUri = `${options.destinationUri}.part`;
  let completed = false;

  try {
    await removeFileIfExists(partialUri);

    const resumable = FileSystem.createDownloadResumable(
      options.url,
      partialUri,
      {},
      (progressEvent) => {
        if (!options.onProgress) {
          return;
        }

        const expectedBytes = progressEvent.totalBytesExpectedToWrite;
        if (expectedBytes <= 0) {
          return;
        }

        const progress =
          (progressEvent.totalBytesWritten / expectedBytes) * 100;
        options.onProgress(clampProgress(progress));
      },
    );

    options.resumableRef.current = resumable;
    const response = await resumable.downloadAsync();

    if (!response?.uri) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Falha ao baixar o modelo. Tente novamente.",
          { url: options.url },
        ),
      );
    }

    const partialInfo = await FileSystem.getInfoAsync(partialUri);
    const downloadedSize =
      "size" in partialInfo && typeof partialInfo.size === "number"
        ? partialInfo.size
        : 0;
    if (!partialInfo.exists || downloadedSize <= 0) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Arquivo baixado esta vazio ou corrompido.",
          {
            partialUri,
            downloadedSize,
          },
        ),
      );
    }

    await removeFileIfExists(options.destinationUri);
    await FileSystem.moveAsync({
      from: partialUri,
      to: options.destinationUri,
    });

    options.onProgress?.(100);
    completed = true;

    return ok({
      uri: options.destinationUri,
      sizeBytes: downloadedSize,
    });
  } catch (error) {
    if (isCancelledDownloadError(error)) {
      return err(
        createError("UNKNOWN_ERROR", "Download cancelado pelo usuario."),
      );
    }

    return err(
      createError(
        "STORAGE_ERROR",
        "Falha ao baixar o modelo. Verifique sua conexao.",
        {
          url: options.url,
          destinationUri: options.destinationUri,
        },
        error as Error,
      ),
    );
  } finally {
    options.resumableRef.current = null;
    if (!completed) {
      await removeFileIfExists(partialUri).catch(() => {
        return;
      });
    }
  }
}
