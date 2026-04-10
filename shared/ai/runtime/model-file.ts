import * as FileSystem from "expo-file-system/legacy";

export interface ModelFileDiagnostics {
  isValid: boolean;
  errorMessage: string;
  details: Record<string, unknown>;
}

export function resolveModelPath(modelPath: string): string {
  if (!modelPath) {
    return modelPath;
  }

  if (modelPath.startsWith("file://")) {
    return modelPath;
  }

  return `file://${modelPath}`;
}

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
