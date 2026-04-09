/**
 * Onboarding: Model configuration domain model
 *
 * Defines the model configuration interface and catalog of available
 * Qwen 2.5 models for on-device inference.
 */

export interface ModelConfiguration {
  id: string;
  displayName: string;
  modelKey: string;
  filePath: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  downloadStatus:
    | "pending"
    | "downloading"
    | "completed"
    | "failed"
    | "cancelled";
  downloadProgress: number;
  isLoaded: boolean;
  lastUsedAt: string | null;
  customFolderUri: string | null;
}

export interface AvailableModel {
  key: string;
  name: string;
  description: string;
  downloadUrl: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
}

/**
 * Model catalog with Qwen 2.5 and Qwen 3 models sorted by quality/capability.
 * URLs are placeholders -- replace with actual hosting URLs.
 */
export const MODEL_CATALOG: AvailableModel[] = [
  {
    key: "qwen2.5-0.5b-instruct",
    name: "Qwen 2.5 0.5B",
    description:
      "Modelo leve e rápido, ideal para dispositivos com pouca memoria RAM.",
    downloadUrl:
      "https://www.modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF/file/view/master/qwen2.5-0.5b-instruct-q2_k.gguf",
    fileSizeBytes: 350 * 1024 * 1024, // ~350 MB
    estimatedRamBytes: 600 * 1024 * 1024, // ~600 MB
    quantization: "Q4_0",
  },
  {
    key: "qwen2.5-1.5b-instruct",
    name: "Qwen 2.5 1.5B",
    description:
      "Equilíbrio entre qualidade e desempenho para a maioria dos dispositivos.",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_0.gguf",
    fileSizeBytes: 938 * 1024 * 1024, // ~938 MB
    estimatedRamBytes: 1800 * 1024 * 1024, // ~1.8 GB
    quantization: "Q4_0",
  },
  {
    key: "qwen2.5-3b-instruct",
    name: "Qwen 2.5 3B",
    description:
      "Modelo de maior qualidade, recomendado para dispositivos com 8GB+ de RAM.",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_0.gguf",
    fileSizeBytes: 1830 * 1024 * 1024, // ~1.83 GB
    estimatedRamBytes: 3500 * 1024 * 1024, // ~3.5 GB
    quantization: "Q4_0",
  },

  {
    key: "qwen3-0.6b",
    name: "Qwen 3 0.6B",
    description:
      "Modelo extremamente leve da família Qwen 3 para dispositivos com pouca RAM.",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf",
    fileSizeBytes: 430 * 1024 * 1024, // ~0.42 GB
    estimatedRamBytes: 800 * 1024 * 1024, // ~0.8 GB
    quantization: "Q4_0",
  },
  {
    key: "qwen3-1.7b",
    name: "Qwen 3 1.7B",
    description:
      "Boa opção intermediária da família Qwen 3 para uso geral local.",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen_Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_0.gguf",
    fileSizeBytes: 1100 * 1024 * 1024, // ~1.1 GB
    estimatedRamBytes: 2200 * 1024 * 1024, // ~2.2 GB
    quantization: "Q4_0",
  },
  {
    key: "qwen3-4b",
    name: "Qwen 3 4B",
    description:
      "Modelo maior da família Qwen 3, com melhor qualidade e maior exigência de memória.",
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_0.gguf",
    fileSizeBytes: 2380 * 1024 * 1024, // ~2.38 GB
    estimatedRamBytes: 4500 * 1024 * 1024, // ~4.5 GB
    quantization: "Q4_0",
  },
];
