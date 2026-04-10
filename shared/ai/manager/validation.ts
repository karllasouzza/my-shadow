import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import {
  DISK_SAFETY_BUFFER_BYTES,
  MIN_EXPECTED_SIZE_RATIO,
  MIN_VALID_MODEL_BYTES,
} from "./constants";
import { ensureFileUri } from "./paths";

type FileSystemWithDiskInfo = typeof FileSystem & {
  getFreeDiskStorageAsync?: () => Promise<number>;
};

export async function fileExists(pathOrUri: string): Promise<boolean> {
  const uri = ensureFileUri(pathOrUri);
  const info = await FileSystem.getInfoAsync(uri);
  return Boolean(info.exists);
}

export async function verifyModelFile(
  pathOrUri: string,
  expectedSizeBytes?: number,
): Promise<Result<number>> {
  try {
    const uri = ensureFileUri(pathOrUri);
    const info = await FileSystem.getInfoAsync(uri);

    if (!info.exists) {
      return err(
        createError("NOT_FOUND", "Arquivo do modelo nao encontrado.", { uri }),
      );
    }

    const fileSize = info.size ?? 0;
    if (fileSize < MIN_VALID_MODEL_BYTES) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Arquivo do modelo esta vazio ou incompleto.",
          {
            uri,
            fileSize,
            minimumBytes: MIN_VALID_MODEL_BYTES,
          },
        ),
      );
    }

    if (expectedSizeBytes && expectedSizeBytes > 0) {
      const minimumExpected = Math.floor(expectedSizeBytes * MIN_EXPECTED_SIZE_RATIO);
      if (fileSize < minimumExpected) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Download incompleto: arquivo menor que o esperado.",
            {
              uri,
              fileSize,
              expectedSizeBytes,
              minimumExpected,
            },
          ),
        );
      }
    }

    return ok(fileSize);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Erro ao validar arquivo do modelo.",
        {},
        error as Error,
      ),
    );
  }
}

export async function hasEnoughDiskSpace(
  requiredBytes: number,
): Promise<Result<boolean>> {
  try {
    if (requiredBytes <= 0) {
      return ok(true);
    }

    const fileSystemWithDiskInfo = FileSystem as FileSystemWithDiskInfo;
    if (!fileSystemWithDiskInfo.getFreeDiskStorageAsync) {
      return ok(true);
    }

    const freeBytes = await fileSystemWithDiskInfo.getFreeDiskStorageAsync();
    const requiredWithBuffer = requiredBytes + DISK_SAFETY_BUFFER_BYTES;
    if (freeBytes < requiredWithBuffer) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Espaco em disco insuficiente para baixar o modelo.",
          {
            freeBytes,
            requiredBytes,
            requiredWithBuffer,
          },
        ),
      );
    }

    return ok(true);
  } catch (error) {
    return err(
      createError(
        "STORAGE_ERROR",
        "Nao foi possivel verificar o espaco em disco.",
        {},
        error as Error,
      ),
    );
  }
}
