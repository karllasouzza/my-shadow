/**
 * Model file utilities: path resolution and diagnostics.
 *
 * Handles GGUF model file path normalization and validates that the file
 * exists on disk with a non-zero size before attempting to load it.
 */

import * as FileSystem from "expo-file-system/legacy";

import type { ModelFileDiagnostics } from "../types";

/**
 * Ensures a model path has the `file://` URI scheme prefix required by
 * `llama.rn` and `expo-file-system`.
 *
 * @param modelPath - Absolute path or `file://` URI to the GGUF model file.
 * @returns The path guaranteed to start with `file://`.
 */
export function resolveModelPath(modelPath: string): string {
  if (!modelPath) {
    return modelPath;
  }

  if (modelPath.startsWith("file://")) {
    return modelPath;
  }

  return `file://${modelPath}`;
}

/**
 * Diagnoses a model file at the given path, checking for existence and
 * minimum valid size.
 *
 * @param filePath - The `file://` URI of the GGUF model to validate.
 * @returns A `ModelFileDiagnostics` object indicating whether the file is
 *          valid and providing error details when it is not.
 */
export async function diagnoseModelFile(
  filePath: string,
): Promise<ModelFileDiagnostics> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return {
        isValid: false,
        errorMessage: `Arquivo do modelo nao encontrado em: ${filePath}`,
        details: { filePath, exists: false },
      };
    }

    const sizeBytes = fileInfo.size ?? 0;
    if (sizeBytes <= 0) {
      return {
        isValid: false,
        errorMessage: "Arquivo do modelo esta vazio.",
        details: { filePath, size: sizeBytes },
      };
    }

    return {
      isValid: true,
      errorMessage: "",
      details: { filePath, size: sizeBytes },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao verificar arquivo";

    return {
      isValid: false,
      errorMessage: `Erro ao verificar arquivo do modelo: ${message}`,
      details: { filePath, error: message },
    };
  }
}
