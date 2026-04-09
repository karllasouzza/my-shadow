/**
 * T012: Implement RAG vector repository wrapper
 *
 * Wraps react-native-rag @react-native-rag/op-sqlite vector store
 * for storing embeddings and retrieving contextual reflections during generation.
 *
 * ===========================================================================
 * T061: DUAL STRATEGY ARCHITECTURE (llama.rn LLM + executorch Embeddings)
 * ===========================================================================
 *
 * This module uses TWO separate native runtimes:
 *
 * 1. llama.rn (LLM inference) — imported via shared/ai/local-ai-runtime.ts
 *    - Handles text generation, guided questions, completions
 *    - Uses GGUF models (Qwen 2.5 family)
 *    - Loaded on-demand, released when not needed
 *
 * 2. @react-native-rag/executorch (Embeddings) — imported directly here
 *    - Handles text embedding for vector similarity search
 *    - Uses MULTI_QA_MINILM_L6_COS_V1 model (384-dimensional vectors)
 *    - Loaded once during RAG repository initialization
 *    - Model/config provided by react-native-executorch
 *
 * WHY TWO RUNTIMES?
 * - llama.rn does NOT currently include embedding generation support in the
 *   version we use (0.10.0). While it has an `embedding` method, it is designed
 *   for the LLM's internal representation, not for semantic search embeddings.
 * - @react-native-rag/executorch provides optimized embedding models
 *   (MiniLM-L6-cos-v1) specifically trained for semantic similarity.
 * - The two runtimes can coexist safely — they use separate native libraries
 *   and do not share memory or state.
 *
 * NO CONFLICTS:
 * - react-native-executorch and llama.rn are independent native modules.
 * - They do not share GPU/CPU resources or memory pools.
 * - Each loads its own model binary into separate memory regions.
 * - Memory usage is additive but manageable on modern devices.
 *
 * ===========================================================================
 * T064: FUTURE MIGRATION PATH — Moving Embeddings to llama.rn
 * ===========================================================================
 *
 * GOAL: Consolidate to a single native runtime (llama.rn) for both LLM
 * inference and embedding generation, reducing app size and memory footprint.
 *
 * PREREQUISITES:
 * 1. Confirm llama.rn supports embedding extraction compatible with
 *    MULTI_QA_MINILM_L6_COS_V1 output format (384-dim cosine similarity).
 *    - Check llama.rn docs for `embedding` API support.
 *    - Verify output vector dimensions match 384.
 *
 * 2. Obtain GGUF embedding model:
 *    - Felladrin/gguf-multi-qa-MiniLM-L6-cos-v1 is the GGUF-converted version
 *      of the same MiniLM model used by executorch.
 *    - Available at: https://huggingface.co/Felladrin/gguf-multi-qa-MiniLM-L6-cos-v1
 *    - This ensures embedding compatibility (same weights, same output space).
 *
 * MIGRATION STEPS:
 * Step 1: Add the GGUF embedding model to the app bundle or download it
 *         alongside the LLM model (same storage directory).
 *
 * Step 2: Create a separate LlamaContext for embeddings:
 *   ```ts
 *   const embeddingContext = await initLlama({
 *     model: "file://path/to/multi-qa-MiniLM-L6-cos-v1.gguf",
 *     embedding: true,     // Enable embedding mode
 *     n_ctx: 384,          // Output dimension
 *     n_gpu_layers: 0,     // Keep on CPU for consistency
 *   });
 *   ```
 *
 * Step 3: Replace ExecuTorchEmbeddings usage in this file with
 *         embeddingContext.embedding(text) calls.
 *
 * Step 4: Validate that new embeddings produce identical (or near-identical)
 *         cosine similarity scores compared to executorch embeddings.
 *         Use the test in tests/integration/rag/rag-retrieval.spec.ts
 *         to verify.
 *
 * Step 5: Remove @react-native-rag/executorch and react-native-executorch
 *         from package.json dependencies.
 *
 * RISKS AND CONSIDERATIONS:
 * - Memory: Running two LlamaContext instances simultaneously (one for LLM,
 *   one for embeddings) doubles the model memory footprint. Consider loading
 *   the embedding context only when needed and releasing it after.
 * - Performance: Embedding generation via llama.rn may be slower than
 *   executorch's optimized path. Benchmark on target devices.
 * - Compatibility: The GGUF conversion may introduce minor numerical
 *   differences. Set a tolerance threshold (e.g., cosine similarity within
 *   0.01 of original scores) in regression tests.
 * - App Size: Removing executorch reduces app size by ~15-20MB, but adding
 *   the GGUF embedding model adds ~90MB. Net increase of ~70MB.
 * ===========================================================================
 */

import { Result, createError, err, ok } from "../utils/app-error";

/**
 * T063: Expected embedding dimension for MULTI_QA_MINILM_L6_COS_V1.
 * All vectors stored in the RAG database must have exactly 384 dimensions.
 * This constant is used to validate embeddings on insert and to verify
 * compatibility with @react-native-rag/executorch.
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

interface RAGNativeModules {
  OPSQLiteVectorStore: any;
  MULTI_QA_MINILM_L6_COS_V1: {
    modelSource: unknown;
    tokenizerSource: unknown;
  };
  // T061: Keep @react-native-rag/executorch for embeddings temporarily
  ExecuTorchEmbeddings: any;
}

/**
 * RAG repository providing vector search capabilities
 */
export class ReflectionRAGRepository {
  private initialized = false;
  private readonly storeName = "reflection-rag-v1";
  private modules: RAGNativeModules | null = null;
  private vectorStore: any = null;

  /**
   * Initialize the RAG vector store
   */
  async initialize(): Promise<Result<void>> {
    try {
      if (this.initialized) {
        return ok(void 0);
      }

      const modulesResult = await this.loadNativeModules();
      if (!modulesResult.success) {
        return err(modulesResult.error);
      }

      this.modules = modulesResult.data;

      // T061: Embeddings are handled by @react-native-rag/executorch directly
      // No need to call initExecutorch - just instantiate embeddings module
      const embeddings = new this.modules.ExecuTorchEmbeddings({
        modelSource: this.modules.MULTI_QA_MINILM_L6_COS_V1.modelSource,
        tokenizerSource: this.modules.MULTI_QA_MINILM_L6_COS_V1.tokenizerSource,
      });

      this.vectorStore = new this.modules.OPSQLiteVectorStore({
        name: this.storeName,
        embeddings,
      });
      await this.vectorStore.load();

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
   * Store embedding for a reflection
   *
   * T063: Validates that pre-computed embeddings have exactly 384 dimensions
   * to ensure compatibility with @react-native-rag/executorch.
   */
  async storeEmbedding(record: EmbeddingRecord): Promise<Result<void>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
      }

      // T063: Validate vector dimensions on insert if pre-computed embedding provided
      if (record.embedding !== undefined && record.embedding !== null) {
        if (record.embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
          return err(
            createError(
              "VALIDATION_ERROR",
              `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIMENSION}, got ${record.embedding.length}`,
              {
                expectedDimension: EXPECTED_EMBEDDING_DIMENSION,
                actualDimension: record.embedding.length,
              },
            ),
          );
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

  private async ensureInitialized(): Promise<Result<void>> {
    if (this.initialized) {
      return ok(void 0);
    }
    return this.initialize();
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

  private async loadNativeModules(): Promise<Result<RAGNativeModules>> {
    try {
      // T061: Keep @react-native-rag/executorch for embeddings temporarily
      // react-native-executorch is still needed for MULTI_QA_MINILM_L6_COS_V1 model config
      const [executorchModule, ragExecuTorchModule, opSqliteModule] =
        await Promise.all([
          import("react-native-executorch"),
          import("@react-native-rag/executorch"),
          import("@react-native-rag/op-sqlite"),
        ]);

      return ok({
        ExecuTorchEmbeddings: ragExecuTorchModule.ExecuTorchEmbeddings,
        OPSQLiteVectorStore: opSqliteModule.OPSQLiteVectorStore,
        MULTI_QA_MINILM_L6_COS_V1: executorchModule.MULTI_QA_MINILM_L6_COS_V1,
      });
    } catch (error) {
      return err(
        createError(
          "NOT_READY",
          "Unable to load native RAG dependencies",
          {},
          error as Error,
        ),
      );
    }
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
