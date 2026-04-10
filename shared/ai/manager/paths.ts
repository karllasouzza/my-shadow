import { Result, createError, err, ok } from "@/shared/utils/app-error";
import * as FileSystem from "expo-file-system/legacy";
import { MODEL_FILE_EXTENSION, MODELS_SUBDIRECTORY } from "./constants";

export function ensureFileUri(pathOrUri: string): string {
  if (pathOrUri.startsWith("file://")) {
    return pathOrUri;
  }

  return `file://${pathOrUri}`;
}

export function getModelsDirectoryUri(): Result<string> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    return err(
      createError("STORAGE_ERROR", "Diretorio de armazenamento indisponivel."),
    );
  }

  return ok(`${documentDirectory}${MODELS_SUBDIRECTORY}/`);
}

export function sanitizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

export function getDefaultModelFileName(modelId: string): string {
  return `${sanitizeModelId(modelId)}${MODEL_FILE_EXTENSION}`;
}

export function resolveModelDestinationUri(
  modelId: string,
  customPathOrUri: string | undefined,
  modelsDirectoryUri: string,
): string {
  if (customPathOrUri && customPathOrUri.trim().length > 0) {
    return ensureFileUri(customPathOrUri);
  }

  return `${modelsDirectoryUri}${getDefaultModelFileName(modelId)}`;
}

export function extractFileNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathName = parsedUrl.pathname;
    const fileName = pathName.substring(pathName.lastIndexOf("/") + 1);
    if (fileName) {
      return decodeURIComponent(fileName);
    }
  } catch {
    const withoutQuery = url.split("?")[0];
    const segments = withoutQuery.split("/").filter(Boolean);
    const fileName = segments[segments.length - 1];
    if (fileName) {
      return decodeURIComponent(fileName);
    }
  }

  return `model${MODEL_FILE_EXTENSION}`;
}

export function resolveLegacyModelUri(
  downloadUrl: string,
  modelsDirectoryUri: string,
): string {
  return `${modelsDirectoryUri}${extractFileNameFromUrl(downloadUrl)}`;
}
