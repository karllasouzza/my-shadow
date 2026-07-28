import * as FileSystem from "expo-file-system/legacy";

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

export function getModelPath(modelId: string): string {
  return `${MODELS_DIR}${modelId}.gguf`;
}

export function getModelsDirectory(): string {
  return MODELS_DIR;
}

export async function ensureModelsDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

export async function modelExists(modelId: string): Promise<boolean> {
  const path = getModelPath(modelId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}
