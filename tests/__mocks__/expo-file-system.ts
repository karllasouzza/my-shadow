/**
 * Mock for expo-file-system/legacy
 * Used during testing to avoid filesystem access
 */

export const documentDirectory = "/mock/documents/";
export const cacheDirectory = "/mock/cache/";

export async function getInfoAsync(
  filepath: string,
): Promise<{ exists: boolean; isDirectory: boolean; size?: number }> {
  // In tests, pretend common test model paths exist
  const testPatterns = ["/test/", "/data/models/", ".gguf", "/models/"];
  if (testPatterns.some((pattern) => filepath.includes(pattern))) {
    return { exists: true, isDirectory: false, size: 500 * 1024 * 1024 }; // 500MB mock
  }
  // Other files don't exist (embeddings will get null path)
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
