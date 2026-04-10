/**
 * T005: Model catalog — available GGUF models for download
 *
 * Source of truth for model metadata. Each entry includes download URL,
 * file size, and estimated RAM for validation before load.
 */

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  downloadUrl: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "qwen2.5-0.5b-instruct",
    displayName: "Qwen 2.5 0.5B",
    description: "Modelo leve e rápido, ideal para dispositivos com pouca RAM.",
    downloadUrl:
      "https://huggingface.co/Sekinna/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf",
    fileSizeBytes: 350 * 1024 * 1024,
    estimatedRamBytes: 600 * 1024 * 1024,
    quantization: "Q2_K",
  },
  {
    id: "qwen2.5-1.5b-instruct",
    displayName: "Qwen 2.5 1.5B",
    description:
      "Equilíbrio entre qualidade e desempenho para a maioria dos dispositivos.",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_0.gguf",
    fileSizeBytes: 938 * 1024 * 1024,
    estimatedRamBytes: 1800 * 1024 * 1024,
    quantization: "Q4_0",
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
  },
];

/** Find catalog entry by ID */
export function findModelById(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
