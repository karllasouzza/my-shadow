/**
 * T012: Implement RAG vector repository wrapper
 *
 * Wraps react-native-rag @react-native-rag/op-sqlite vector store
 * for storing embeddings and retrieving contextual reflections during generation.
 *
 * ===========================================================================
 * T064: UNIFIED ARCHITECTURE — llama.rn for Both LLM + Embeddings
 * ===========================================================================
 *
 * This module uses ONE native runtime (llama.rn) for both:
 *
 * 1. llama.rn (LLM inference) — imported via shared/ai/local-ai-runtime.ts
 *    - Handles text generation, guided questions, completions
 *    - Uses GGUF models (Qwen 2.5 family)
 *    - Loaded on-demand, released when not needed
 *
 * 2. llama.rn (Embedding generation) — imported directly here
 *    - Handles text embedding for vector similarity search
 *    - Uses GGUF embedding model (Felladrin/gguf-multi-qa-MiniLM-L6-cos-v1)
 *    - Returns 384-dimensional vectors compatible with original executorch output
 *    - Loaded once during RAG repository initialization
 *
 * CONSOLIDATED ARCHITECTURE:
 * - Removed @react-native-rag/executorch and react-native-executorch
 * - Single LlamaContext for embeddings initialized with:
 *   * embedding: true
 *   * pooling_type: 'mean'
 *   * embd_normalize: 1 (L2 normalization)
 * - API: context.embedding(text) returns { embedding: number[] }
 *
 * BENEFITS:
 * - Simplified dependency graph (single native module)
 * - Faster startup (no ResourceFetcher adapter initialization)
 * - Easier to debug (single runtime configuration)
 * - Reduced app size long-term (when embedding model is downloaded on-demand)
 *
 * EMBEDDING MODEL:
 * - Source: Felladrin/gguf-multi-qa-MiniLM-L6-cos-v1
 * - Dimensions: 384 (compatible with previous executorch output)
 * - Path pattern: Same storage directory as LLM models
 * ===========================================================================
 */

import { LlamaContext, initLlama as initLlamaNative } from "llama.rn";
import { Result, createError, err, ok } from "../utils/app-error";

/**
 * Expected embedding dimension for MiniLM-L6-cos-v1 (via GGUF).
 * All vectors stored in the RAG database must have exactly 384 dimensions.
 * This constant is used to validate embeddings on insert and to verify
 * compatibility with llama.rn embedding output.
 */
export const EXPECTED_EMBEDDING_DIMENSION = 384;

export interface EmbeddingRecord {
  id: string;
  reflectionId: string;
  text: string;
  embedding?: number[]; // Optional pre-computed vector
  metadata: {
    entryDate: string;
    moodTags?: string[];
    triggerTags?: string[];
  };
}

export interface RetrievalResult {
  reflectionId: string;
  score: number; // Cosine similarity 0-1
  text: string;
  entryDate: string;
}

/**
 * RAG repository providing vector search capabilities
 */
export class ReflectionRAGRepository {
  private initialized = false;
  private readonly storeName = "reflection-rag-v1";
  private embeddingContext: LlamaContext | null = null;
  private vectorStore: any = null;

  /**
   * Initialize the RAG vector store and embedding context
   *
   * Note: Embedding model path is auto-discovered from app storage.
   * The embedding context is lazily loaded on first use to defer model loading.
   */
  async initialize(): Promise<Result<void>> {
    try {
      if (this.initialized) {
        return ok(void 0);
      }

      // Load vector store (lazy-load embedding context on first embedding operation)
      try {
        const OPSQLiteVectorStore = await this.loadVectorStore();
        if (!OPSQLiteVectorStore) {
          throw new Error("OPSQLiteVectorStore not available");
        }

        // Create embeddings adapter that handles lazy-loading
        const embeddingsAdapter = {
          embedQuery: async (text: string): Promise<number[]> => {
            // Lazy initialize embedding context on first use
            if (!this.embeddingContext) {
              const initResult = await this.ensureEmbeddingContextInitialized();
              if (!initResult.success) {
                throw initResult.error;
              }
            }
            const result = await this.embeddingContext!.embedding(text);
            return result.embedding;
          },
        };

        this.vectorStore = new OPSQLiteVectorStore({
          name: this.storeName,
          embeddings: embeddingsAdapter,
        });

        await this.vectorStore.load();
      } catch (error) {
        return err(
          createError(
            "NOT_READY",
            "Failed to initialize vector store",
            {},
            error as Error,
          ),
        );
      }

      this.initialized = true;
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Failed to initialize RAG repository",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Ensure embedding context is initialized (lazy-load)
   *
   * This discovers the embedding model path from app storage and initializes
   * llama.rn embedding context on first call.
   */
  private async ensureEmbeddingContextInitialized(): Promise<Result<void>> {
    if (this.embeddingContext) {
      return ok(void 0);
    }

    try {
      // Discover embedding model path from common locations
      // Priority: 1) explicit model path, 2) app cache, 3) error
      const embeddingModelPath = await this.discoverEmbeddingModelPath();
      if (!embeddingModelPath) {
        return err(
          createError(
            "NOT_READY",
            "Embedding model not found. Ensure multi-qa-MiniLM-L6-cos-v1.gguf is available in app models directory.",
            {
              expectedFilename: "multi-qa-MiniLM-L6-cos-v1.gguf",
              searchLocations: ["expo-cache/models", "expo-documents/models"],
            },
          ),
        );
      }

      try {
        console.log(
          "[ReflectionRAGRepository] Initializing embedding context with:",
          {
            path: embeddingModelPath,
          },
        );

        this.embeddingContext = await initLlamaNative({
          model: embeddingModelPath,
          embedding: true, // Enable embedding mode
          pooling_type: "mean", // Pool token embeddings by averaging
          embd_normalize: 1, // L2 normalization (unit vectors)
          n_ctx: 384, // Context size for embeddings
          n_gpu_layers: 0, // Keep on CPU for consistency
        });

        console.log(
          "[ReflectionRAGRepository] Embedding context initialized successfully",
        );
        return ok(void 0);
      } catch (error) {
        return err(
          createError(
            "NOT_READY",
            "Failed to initialize embedding model with llama.rn",
            { path: embeddingModelPath },
            error as Error,
          ),
        );
      }
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Failed to initialize embedding context",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Discover embedding model path by checking common app directories
   *
   * In test/mock environments, returns null gracefully
   */
  private async discoverEmbeddingModelPath(): Promise<string | null> {
    try {
      // Dynamically import FileSystem only in native environments
      // This prevents Jest from trying to parse expo-file-system during tests
      let FileSystem: any;
      try {
        const fsModule = await import("expo-file-system/legacy");
        FileSystem = fsModule;
      } catch (importError) {
        // In test environments, FileSystem may not be available
        console.debug(
          "[ReflectionRAGRepository] FileSystem not available (expected in test env)",
        );
        return null;
      }

      if (!FileSystem || !FileSystem.documentDirectory) {
        return null;
      }

      // Expected filename for embedding model
      const embeddingFilename = "multi-qa-MiniLM-L6-cos-v1.gguf";

      // Check common directories
      const searchDirs = [
        `${FileSystem.documentDirectory}models`,
        `${FileSystem.cacheDirectory}models`,
      ].filter((dir) => !!dir);

      for (const dir of searchDirs) {
        try {
          const exists = await FileSystem.getInfoAsync(dir);
          if (!exists.exists) {
            continue;
          }

          // Check if model file exists in directory
          const modelPath = `${dir}/${embeddingFilename}`;
          const modelExists = await FileSystem.getInfoAsync(modelPath);
          if (modelExists.exists && modelExists.isDirectory === false) {
            return modelPath;
          }
        } catch (e) {
          // Continue to next directory
          continue;
        }
      }

      return null;
    } catch (error) {
      console.debug(
        "[ReflectionRAGRepository] Error discovering embedding model:",
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Load the OPSQLiteVectorStore from react-native-rag package
   */
  private async loadVectorStore(): Promise<any> {
    try {
      const rag = await import("@react-native-rag/op-sqlite");
      return rag.OPSQLiteVectorStore;
    } catch (error) {
      throw new Error(
        "Failed to load @react-native-rag/op-sqlite. Ensure it is installed.",
      );
    }
  }

  /**
   * Check if RAG repository is initialized
   */
  private async ensureInitialized(): Promise<Result<void>> {
    if (!this.initialized) {
      return err(
        createError(
          "NOT_READY",
          "RAG repository not initialized. Call initialize() first.",
        ),
      );
    }
    return ok(void 0);
  }

  /**
   * Store embedding for a reflection
   *
   * Validates that pre-computed embeddings have exactly 384 dimensions
   * to ensure compatibility with llama.rn embedding output.
   */
  async storeEmbedding(record: EmbeddingRecord): Promise<Result<void>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
      }

      // Validate vector dimensions on insert if pre-computed embedding provided
      if (record.embedding !== undefined && record.embedding !== null) {
        const validationResult =
          ReflectionRAGRepository.validateEmbeddingDimension(record.embedding);
        if (!validationResult.success) {
          return err(validationResult.error);
        }
      }

      // Upsert by removing stale vectors for this reflection before insert.
      await this.vectorStore.delete({
        predicate: (value: any) =>
          value.id === record.id ||
          value.metadata?.reflectionId === record.reflectionId,
      });

      await this.vectorStore.add({
        id: record.id,
        document: record.text,
        embedding: record.embedding,
        metadata: {
          reflectionId: record.reflectionId,
          entryDate: record.metadata.entryDate,
          moodTags: record.metadata.moodTags ?? [],
          triggerTags: record.metadata.triggerTags ?? [],
        },
      });

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to store embedding",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Search for similar reflections using vector similarity
   */
  async search(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<Result<RetrievalResult[]>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
      }

      const results = await this.vectorStore.query({
        queryEmbedding,
        nResults: limit,
      });

      return ok(this.mapQueryResults(results, threshold));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to search embeddings",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Search for similar reflections using raw text query.
   */
  async searchByText(
    queryText: string,
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<Result<RetrievalResult[]>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
      }

      const results = await this.vectorStore.query({
        queryText,
        nResults: limit,
      });

      return ok(this.mapQueryResults(results, threshold));
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to search embeddings",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Delete embedding for a reflection
   */
  async deleteEmbedding(reflectionId: string): Promise<Result<void>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
      }

      await this.vectorStore.delete({
        predicate: (value: any) =>
          value.metadata?.reflectionId === reflectionId ||
          value.id === reflectionId,
      });

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to delete embedding",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Get all embeddings for a date range
   */
  async getEmbeddingsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Result<EmbeddingRecord[]>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
      }

      const rows = await this.vectorStore.db.execute(
        "SELECT id, document, embedding, metadata FROM vectors",
      );

      const records: EmbeddingRecord[] = [];
      for (const row of rows.rows as any[]) {
        const metadata = this.parseMetadata(row.metadata);
        if (!metadata.entryDate) {
          continue;
        }
        if (metadata.entryDate < startDate || metadata.entryDate > endDate) {
          continue;
        }

        records.push({
          id: String(row.id),
          reflectionId: String(metadata.reflectionId ?? row.id),
          text: String(row.document ?? ""),
          embedding: this.toEmbeddingArray(row.embedding),
          metadata: {
            entryDate: String(metadata.entryDate),
            moodTags: Array.isArray(metadata.moodTags)
              ? metadata.moodTags
              : undefined,
            triggerTags: Array.isArray(metadata.triggerTags)
              ? metadata.triggerTags
              : undefined,
          },
        });
      }

      return ok(records);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to retrieve embeddings",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Clear all embeddings (for testing/factory reset)
   */
  async clear(): Promise<Result<void>> {
    try {
      if (!this.initialized || !this.vectorStore) {
        return ok(void 0);
      }

      if (typeof this.vectorStore.deleteVectorStore === "function") {
        await this.vectorStore.deleteVectorStore();
      }

      await this.vectorStore.unload();
      this.vectorStore = null;
      this.initialized = false;

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          "Failed to clear embeddings",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * T063: Validate that a vector has the expected dimension.
   * Returns an error if the dimension does not match EXPECTED_EMBEDDING_DIMENSION.
   */
  static validateEmbeddingDimension(vector: number[]): Result<void> {
    if (vector.length !== EXPECTED_EMBEDDING_DIMENSION) {
      return err(
        createError(
          "VALIDATION_ERROR",
          `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIMENSION}, got ${vector.length}`,
          {
            expectedDimension: EXPECTED_EMBEDDING_DIMENSION,
            actualDimension: vector.length,
          },
        ),
      );
    }
    return ok(void 0);
  }

  /**
   * T065: Compute cosine similarity between two vectors.
   * Both vectors must have the same dimension (validated).
   * Returns similarity score between -1 and 1 (1 = identical).
   */
  static cosineSimilarity(a: number[], b: number[]): Result<number> {
    if (a.length !== b.length) {
      return err(
        createError(
          "VALIDATION_ERROR",
          `Vector dimension mismatch: cannot compute cosine similarity between ${a.length} and ${b.length} dim vectors`,
        ),
      );
    }
    if (a.length === 0) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Cannot compute cosine similarity of empty vectors",
        ),
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Cannot compute cosine similarity with zero vector",
        ),
      );
    }

    return ok(dotProduct / denominator);
  }

  private mapQueryResults(rows: any[], threshold: number): RetrievalResult[] {
    return rows
      .map((row) => {
        const metadata = this.parseMetadata(row.metadata);
        return {
          reflectionId: String(metadata.reflectionId ?? row.id),
          score: Number(row.similarity ?? 0),
          text: String(row.document ?? ""),
          entryDate: String(metadata.entryDate ?? ""),
        } as RetrievalResult;
      })
      .filter((row) => row.score >= threshold);
  }

  private parseMetadata(metadata: unknown): Record<string, any> {
    if (!metadata) {
      return {};
    }

    if (typeof metadata === "string") {
      try {
        return JSON.parse(metadata);
      } catch {
        return {};
      }
    }

    if (typeof metadata === "object") {
      return metadata as Record<string, any>;
    }

    return {};
  }

  private toEmbeddingArray(rawEmbedding: unknown): number[] {
    if (Array.isArray(rawEmbedding)) {
      return rawEmbedding.map((value) => Number(value));
    }

    if (rawEmbedding instanceof Float32Array) {
      return Array.from(rawEmbedding);
    }

    if (rawEmbedding instanceof ArrayBuffer) {
      return Array.from(new Float32Array(rawEmbedding));
    }

    if (ArrayBuffer.isView(rawEmbedding)) {
      const view = rawEmbedding as Uint8Array;
      const slicedBuffer = view.buffer.slice(
        view.byteOffset,
        view.byteOffset + view.byteLength,
      );
      if (slicedBuffer.byteLength % 4 === 0) {
        return Array.from(new Float32Array(slicedBuffer));
      }
    }

    return [];
  }
}

// Singleton instance
let ragInstance: ReflectionRAGRepository;

export const getReflectionRAGRepository = (): ReflectionRAGRepository => {
  if (!ragInstance) {
    ragInstance = new ReflectionRAGRepository();
  }
  return ragInstance;
};
