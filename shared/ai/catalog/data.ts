/**
 * T008: Static model catalog data
 *
 * Contains 3 Qwen 2.5 GGUF models with rich metadata.
 * Each entry includes tags for filtering and search.
 */

import type { ModelCatalogEntry } from "./types";

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "qwen2.5-0.5b-instruct",
    displayName: "Qwen 2.5 0.5B",
    description:
      "Modelo leve e rápido, ideal para dispositivos com pouca RAM (< 4GB).",
    downloadUrl:
      "https://huggingface.co/Sekinna/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf",
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
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_0.gguf",
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
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_0.gguf",
    fileSizeBytes: 1830 * 1024 * 1024,
    estimatedRamBytes: 3500 * 1024 * 1024,
    quantization: "Q4_0",
    params: "3B",
    tags: ["high-quality", "instruct", "high-ram"],
  },
];
