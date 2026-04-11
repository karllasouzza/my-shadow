/**
 * Model Catalog
 *
 * Catálogo de modelos GGUF disponíveis para download.
 * IDs no formato HuggingFace: "owner/repo/file.gguf"
 */

import type { ModelCatalogEntry } from "./types";

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "qwen2.5-0.5b-instruct",
    displayName: "Qwen 2.5 0.5B",
    description:
      "Modelo leve e rápido, ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId:
      "Sekinna/Qwen2.5-0.5B-Instruct-GGUF/qwen2.5-0.5b-instruct-q2_k.gguf",
    fileSizeBytes: 350 * 1024 * 1024,
    estimatedRamBytes: 600 * 1024 * 1024,
    quantization: "Q2_K",
    params: "0.5B",
    tags: ["lightweight", "instruct", "fast", "low-ram"],
  },
  {
    id: "qwen2.5-1.5b-instruct",
    displayName: "Qwen 2.5 1.5B",
    description:
      "Equilíbrio entre qualidade e desempenho para a maioria dos dispositivos (4-6GB RAM).",
    huggingFaceId:
      "bartowski/Qwen2.5-1.5B-Instruct-GGUF/Qwen2.5-1.5B-Instruct-Q4_0.gguf",
    fileSizeBytes: 938 * 1024 * 1024,
    estimatedRamBytes: 1800 * 1024 * 1024,
    quantization: "Q4_0",
    params: "1.5B",
    tags: ["balanced", "instruct", "mid-range"],
  },
  {
    id: "qwen2.5-3b-instruct",
    displayName: "Qwen 2.5 3B",
    description:
      "Modelo de maior qualidade, recomendado para dispositivos com 8GB+ de RAM.",
    huggingFaceId:
      "bartowski/Qwen2.5-3B-Instruct-GGUF/Qwen2.5-3B-Instruct-Q4_0.gguf",
    fileSizeBytes: 1830 * 1024 * 1024,
    estimatedRamBytes: 3500 * 1024 * 1024,
    quantization: "Q4_0",
    params: "3B",
    tags: ["high-quality", "instruct", "high-ram"],
  },
  {
    id: "qwen3-0.6b",
    displayName: "Qwen 3 0.6B",
    description:
      "Modelo extremamente leve da família Qwen 3 para dispositivos com pouca RAM.",
    huggingFaceId: "bartowski/Qwen_Qwen3-0.6B-GGUF/Qwen3-0.6B-Q4_0.gguf",
    fileSizeBytes: 430 * 1024 * 1024, // ~0.42 GB
    estimatedRamBytes: 800 * 1024 * 1024, // ~0.8 GB
    quantization: "Q4_0",
    params: "0.6B",
    tags: ["lightweight", "instruct", "low-ram"],
  },
  {
    id: "qwen3-1.7b",
    displayName: "Qwen 3 1.7B",
    description:
      "Boa opção intermediária da família Qwen 3 para uso geral local.",
    huggingFaceId: "bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen3-1.7B-Q4_0.gguf",
    fileSizeBytes: 1100 * 1024 * 1024, // ~1.1 GB
    estimatedRamBytes: 2200 * 1024 * 1024, // ~2.2 GB
    quantization: "Q4_0",
    params: "1.7B",
    tags: ["balanced", "instruct", "mid-range"],
  },
  {
    id: "qwen3-4b",
    displayName: "Qwen 3 4B",
    description:
      "Modelo maior da família Qwen 3, com melhor qualidade e maior exigência de memória.",
    huggingFaceId: "bartowski/Qwen_Qwen3-4B-GGUF/Qwen3-4B-Q4_0.gguf",
    fileSizeBytes: 2380 * 1024 * 1024, // ~2.38 GB
    estimatedRamBytes: 4500 * 1024 * 1024, // ~4.5 GB
    quantization: "Q4_0",
    params: "4B",
    tags: ["high-quality", "instruct", "high-ram"],
  },
];

/** Retorna todos os modelos do catálogo */
export function getAllModels(): ModelCatalogEntry[] {
  return [...MODEL_CATALOG];
}

/** Busca modelo por ID */
export function findModelById(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}

/** Filtra modelos por RAM disponível */
export function getModelsByRam(maxRamBytes: number): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter(
    (model) => model.estimatedRamBytes <= maxRamBytes,
  );
}
