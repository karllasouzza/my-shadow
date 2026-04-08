/**
 * T012: Implement RAG vector repository wrapper
 *
 * Wraps react-native-rag @react-native-rag/op-sqlite vector store
 * for storing embeddings and retrieving contextual reflections during generation.
 */

import { Result, createError, err, ok } from "../utils/app-error";

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
  initExecutorch: (config: any) => void;
  ExpoResourceFetcher: unknown;
  ExecuTorchEmbeddings: any;
  OPSQLiteVectorStore: any;
  MULTI_QA_MINILM_L6_COS_V1: {
    modelSource: unknown;
    tokenizerSource: unknown;
  };
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
      this.modules.initExecutorch({
        resourceFetcher: this.modules.ExpoResourceFetcher,
      });

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
   */
  async storeEmbedding(record: EmbeddingRecord): Promise<Result<void>> {
    try {
      const readyResult = await this.ensureInitialized();
      if (!readyResult.success) {
        return err(readyResult.error);
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
      const [executorchModule, ragExecuTorchModule, opSqliteModule, fetcher] =
        await Promise.all([
          import("react-native-executorch"),
          import("@react-native-rag/executorch"),
          import("@react-native-rag/op-sqlite"),
          import("react-native-executorch-expo-resource-fetcher"),
        ]);

      return ok({
        initExecutorch: executorchModule.initExecutorch,
        ExpoResourceFetcher: fetcher.ExpoResourceFetcher,
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
