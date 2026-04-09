/**
 * Mock for @react-native-rag/op-sqlite
 * Provides OPSQLiteVectorStore class
 */

// Shared mock state for tracking stored records
export const mockRecords: Array<{
  id: string;
  document: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}> = [];

// Helper to compute cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Helper to generate deterministic embeddings
function generateEmbedding(_text: string): number[] {
  const hash = 42;
  return Array(384)
    .fill(0)
    .map((_, i) => Math.sin(hash + i * 0.1) * 0.1);
}

export class OPSQLiteVectorStore {
  constructor(_config: any) {
    // Mock constructor
  }

  async load(): Promise<void> {
    // Mock load
  }

  async unload(): Promise<void> {
    // Mock unload
  }

  async deleteVectorStore(): Promise<void> {
    mockRecords.length = 0;
  }

  async add(item: {
    id: string;
    document: string;
    embedding?: number[];
    metadata: Record<string, unknown>;
  }): Promise<void> {
    mockRecords.push({
      id: item.id,
      document: item.document,
      embedding: item.embedding ?? generateEmbedding(item.document),
      metadata: item.metadata || {},
    });
  }

  async query(params: {
    queryEmbedding?: number[];
    queryText?: string;
    nResults?: number;
  }): Promise<Array<{ id: string; document: string; similarity: number; metadata: string }>> {
    const queryVec = params.queryEmbedding ?? generateEmbedding(params.queryText || "");
    const nResults = params.nResults ?? 5;

    const scored = mockRecords.map((v) => ({
      ...v,
      similarity: cosineSimilarity(queryVec, v.embedding),
    }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, nResults)
      .map(({ id, document, similarity, metadata }) => ({
        id,
        document,
        similarity,
        metadata: JSON.stringify(metadata),
      }));
  }

  async delete({ predicate }: { predicate: (value: any) => boolean }): Promise<void> {
    for (let i = mockRecords.length - 1; i >= 0; i--) {
      const v = mockRecords[i];
      if (predicate({ id: v.id, metadata: v.metadata })) {
        mockRecords.splice(i, 1);
      }
    }
  }

  db = {
    execute: async (_sql: string) => ({
      rows: mockRecords.map((r) => ({
        id: r.id,
        document: r.document,
        embedding: r.embedding,
        metadata: JSON.stringify(r.metadata),
      })),
    }),
  };
}

export default { OPSQLiteVectorStore };
