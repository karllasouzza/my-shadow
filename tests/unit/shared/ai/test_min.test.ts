import { describe, it, expect, mock } from "bun:test";
import * as fc from "fast-check";

console.log("File loading...");

mock.module("react-native", () => ({
  Platform: { OS: "test" },
}));

mock.module("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  getInfoAsync: async () => ({ exists: false }),
  makeDirectoryAsync: async () => {},
  readDirectoryAsync: async () => [],
  deleteAsync: async () => {},
  createDownloadResumable: () => ({
    downloadAsync: async () => ({ uri: "file:///documents/models/model.gguf" }),
    pauseAsync: async () => {},
  }),
}));

mock.module("@/shared/ai/text-generation/runtime", () => ({
  getAIRuntime: () => ({
    getCurrentModel: () => null,
    unloadModel: async () => ({ success: true }),
  }),
}));

mock.module("@/shared/ai/log", () => ({
  aiDebug: () => {},
  aiInfo: () => {},
  aiError: () => {},
}));

interface ManagerAPI {
  downloadModelById: (
    modelId: string,
    link: string,
    modelType: "gguf" | "bin",
    onProgress?: (info: { modelId: string; progress: number }) => void,
  ) => Promise<{ success: boolean; data?: string }>;
  invalidateDownloadedModelsCache: () => void;
  _clearActiveDownloadsForTesting: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _cache: any = null;
function getManager(): ManagerAPI {
  if (!_cache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _cache = require("@/shared/ai/manager");
  }
  return _cache as ManagerAPI;
}

console.log("About to define describe blocks...");

describe("Property 2: test", () => {
  console.log("Inside describe");
  
  it("works", async () => {
    const { downloadModelById } = getManager();
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (n) => {
          expect(n).toBeGreaterThan(0);
          void downloadModelById;
        }
      ),
      { numRuns: 3 }
    );
  });
});

console.log("File loaded.");
