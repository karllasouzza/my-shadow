/**
 * Mock for expo-file-system/legacy
 * Used during testing to avoid filesystem access
 */

export const documentDirectory = "/mock/documents/";
export const cacheDirectory = "/mock/cache/";

export async function getInfoAsync(
  _filepath: string,
): Promise<{ exists: boolean; isDirectory: boolean }> {
  // In tests, pretend files don't exist (embeddings will get null path)
  return { exists: false, isDirectory: false };
}

export async function readAsStringAsync(_filepath: string): Promise<string> {
  throw new Error("FileSystem not available in test environment");
}

export async function writeAsStringAsync(
  _filepath: string,
  _content: string,
): Promise<void> {
  throw new Error("FileSystem not available in test environment");
}

export async function deleteAsync(_filepath: string): Promise<void> {
  throw new Error("FileSystem not available in test environment");
}

export async function makeDirectoryAsync(
  _filepath: string,
  _options?: any,
): Promise<void> {
  throw new Error("FileSystem not available in test environment");
}

export default {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  makeDirectoryAsync,
};
