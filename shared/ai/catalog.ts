import type { Model } from "./types/model";

export const MODEL_CATALOG: Model[] = [
  // Periquito e Sabiá
  {
    id: "periquito-3b",
    displayName: "Periquito 3B",
    description:
      "Modelo de 3B parâmetros treinado do zero em português. Boa opção para dispositivos com 4-6GB de RAM.",
    huggingFaceId: "mradermacher/periquito-3B-i1-GGUF",
    downloadLink:
      "https://huggingface.co/mradermacher/periquito-3B-i1-GGUF/resolve/main/periquito-3B.i1-Q4_K_M.gguf",
    fileSizeBytes: 2.69 * 1024 * 1024,
    estimatedRamBytes: 3300 * 1024 * 1024,
    bytes: "3B",
    tags: ["equilibrado", "português", "ram-moderada"],
  },
  {
    id: "sabia-7b",
    displayName: "Sabiá 7B",
    description:
      "Um dos primeiros grandes modelos de linguagem treinados especificamente para o português. Requer 8GB+ de RAM.",
    huggingFaceId: "lucianosb/sabia-7b-GGUF",
    downloadLink:
      "https://huggingface.co/lucianosb/sabia-7b-GGUF/resolve/main/sabia7b-q4_0.gguf",
    fileSizeBytes: 3830 * 1024 * 1024,
    estimatedRamBytes: 6500 * 1024 * 1024,
    bytes: "7B",
    tags: ["português", "alta-qualidade"],
  },

  // Phi-3 based
  {
    id: "phi-3-portuguese-tom-cat-4k",
    displayName: "Phi-3 Portuguese Tom Cat",
    description:
      "Microsoft Phi-3-mini otimizado para português com 300k instruções. Ótimo custo-benefício para 6-8GB de RAM.",
    huggingFaceId:
      "noxinc/phi-3-portuguese-tom-cat-4k-instruct-Q4_K_M-GGUF-PTBR",
    downloadLink:
      "https://huggingface.co/noxinc/phi-3-portuguese-tom-cat-4k-instruct-Q4_K_M-GGUF-PTBR/resolve/main/phi-3-portuguese-tom-cat-4k-instruct.Q4_K_M.gguf",
    fileSizeBytes: 2300 * 1024 * 1024,
    estimatedRamBytes: 4200 * 1024 * 1024,
    bytes: "3.8B",
    tags: ["alta-qualidade", "português", "instrutor", "ram-moderada"],
    supportsReasoning: true,
  },

  // QWEN 2.5
  {
    id: "qwen2.5-0.5b-instruct",
    displayName: "Qwen 2.5",
    description:
      "Modelo leve e rápido, ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    fileSizeBytes: 491 * 1024 * 1024,
    estimatedRamBytes: 800 * 1024 * 1024,
    downloadLink:
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    bytes: "0.5B",
    tags: ["ultra-leve", "rápido"],
  },
  {
    id: "qwen2.5-1.5b-instruct",
    displayName: "Qwen 2.5",
    description:
      "Equilíbrio entre qualidade e desempenho para a maioria dos dispositivos (4-6GB RAM).",
    huggingFaceId: "bartowski/Qwen2.5-1.5B-Instruct-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf",
    fileSizeBytes: 986 * 1024 * 1024,
    estimatedRamBytes: 1800 * 1024 * 1024,
    bytes: "1.5B",
    tags: ["equilibrado"],
  },
  {
    id: "qwen2.5-3b-instruct",
    displayName: "Qwen 2.5",
    description:
      "Modelo de maior qualidade, recomendado para dispositivos com 8GB+ de RAM.",
    huggingFaceId: "bartowski/Qwen2.5-3B-Instruct-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    fileSizeBytes: 1930 * 1024 * 1024,
    estimatedRamBytes: 3500 * 1024 * 1024,
    bytes: "3B",
    tags: ["alta-qualidade"],
  },

  // QWEN 3
  {
    id: "qwen3-0.6b",
    displayName: "Qwen 3",
    description:
      "Modelo extremamente leve da família Qwen 3 para dispositivos com pouca RAM.",
    huggingFaceId: "bartowski/Qwen_Qwen3-0.6B-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf",
    fileSizeBytes: 483 * 1024 * 1024,
    estimatedRamBytes: 900 * 1024 * 1024,
    bytes: "0.6B",
    tags: ["ultra-leve"],
    supportsReasoning: true,
  },
  {
    id: "qwen3-1.7b",
    displayName: "Qwen 3",
    description:
      "Boa opção intermediária da família Qwen 3 para uso geral local.",
    huggingFaceId: "bartowski/Qwen_Qwen3-1.7B-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Qwen_Qwen3-1.7B-GGUF/resolve/main/Qwen_Qwen3-1.7B-Q4_K_M.gguf",
    fileSizeBytes: 1280 * 1024 * 1024,
    estimatedRamBytes: 2200 * 1024 * 1024,
    bytes: "1.7B",
    tags: ["equilibrado"],
    supportsReasoning: true,
  },
  {
    id: "qwen3-4b",
    displayName: "Qwen 3",
    description:
      "Modelo maior da família Qwen 3, com melhor qualidade e maior exigência de memória.",
    huggingFaceId: "bartowski/Qwen_Qwen3-4B-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Qwen_Qwen3-4B-GGUF/resolve/main/Qwen_Qwen3-4B-Q4_0.gguf",
    fileSizeBytes: 2500 * 1024 * 1024,
    estimatedRamBytes: 4500 * 1024 * 1024,
    bytes: "4B",
    tags: ["alta-qualidade"],
    supportsReasoning: true,
  },
  // Gemma 2
  {
    id: "gemma-2-2b-it",
    displayName: "Gemma 2",
    description:
      "Modelo equilibrado e moderno do Google, com excelente compreensão de instruções para dispositivos com 4-6GB de RAM.",
    huggingFaceId: "tensorblock/gemma-2b-it-GGUF",
    downloadLink:
      "https://huggingface.co/tensorblock/gemma-2b-it-GGUF/resolve/main/gemma-2b-it-Q3_K_M.gguf",
    fileSizeBytes: 1380 * 1024 * 1024,
    estimatedRamBytes: 2600 * 1024 * 1024,
    bytes: "2B",
    tags: ["equilibrado"],
  },

  // Gemma 3
  {
    id: "gemma-3-1b-it",
    displayName: "Gemma 3",
    description:
      "Modelo extremamente leve do Google, ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId: "unsloth/gemma-3-1b-it-GGUF",
    downloadLink:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf",
    fileSizeBytes: 806 * 1024 * 1024,
    estimatedRamBytes: 1600 * 1024 * 1024,
    bytes: "1B",
    tags: ["ultra-leve"],
    supportsReasoning: true,
  },
  {
    id: "gemma-3-4b-it",
    displayName: "Gemma 3",
    description:
      "Modelo de alta qualidade do Google, recomendado para dispositivos com 8GB+ de RAM. Suporta raciocínio (reasoning).",
    huggingFaceId: "unsloth/gemma-3-4b-it-GGUF",
    downloadLink:
      "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf",
    fileSizeBytes: 2490 * 1024 * 1024,
    estimatedRamBytes: 4500 * 1024 * 1024,
    bytes: "4B",
    tags: ["alta-qualidade"],
    supportsReasoning: true,
  },

  // DeepSeek R1 Destilado (Distilled)
  {
    id: "deepseek-r1-distill-qwen-1.5b",
    displayName: "DeepSeek R1",
    description:
      "Modelo com capacidade de raciocínio (reasoning), destilado do DeepSeek R1. Muito capaz para seu tamanho (4-6GB RAM).",
    huggingFaceId: "lmstudio-community/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
    downloadLink:
      "https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    fileSizeBytes: 1200 * 1024 * 1024,
    estimatedRamBytes: 2400 * 1024 * 1024,
    bytes: "1.5B",
    tags: ["equilibrado"],
    supportsReasoning: true,
  },
  {
    id: "deepseek-r1-distill-qwen-7b",
    displayName: "DeepSeek R1",
    description:
      "Modelo de raciocínio destilado do DeepSeek R1, com excelente qualidade para tarefas complexas (8GB+ RAM).",
    huggingFaceId: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
    fileSizeBytes: 4680 * 1024 * 1024,
    estimatedRamBytes: 8000 * 1024 * 1024,
    bytes: "7B",
    tags: ["alta-qualidade", "reasoning", "deepseek", "alta-ram"],
    supportsReasoning: true,
  },
  {
    id: "deepseek-r1-distill-llama-8b",
    displayName: "DeepSeek R1",
    description:
      "Variante destilada do DeepSeek R1 baseada no Llama 3.1 8B. Excelente qualidade para tarefas complexas (8GB+ RAM).",
    huggingFaceId: "unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF",
    downloadLink:
      "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF/resolve/main/DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
    fileSizeBytes: 4920 * 1024 * 1024,
    estimatedRamBytes: 7500 * 1024 * 1024,
    bytes: "8B",
    tags: ["alta-qualidade"],
    supportsReasoning: true,
  },

  // Llama 3.2
  {
    id: "llama-3.2-1b-instruct",
    displayName: "Llama 3.2",
    description:
      "Modelo leve da Meta, rápido e eficiente para conversação e sumarização. Ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId:
      "bartowski/Llama-3.2-1B-Instruct-GGUF/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    downloadLink:
      "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    fileSizeBytes: 808 * 1024 * 1024,
    estimatedRamBytes: 1200 * 1024 * 1024,
    bytes: "1B",
    tags: ["ultra-leve"],
    supportsReasoning: true,
  },
  {
    id: "llama-3.2-3b-instruct",
    displayName: "Llama 3.2",
    description:
      "Modelo de 3B da Meta, oferecendo ótima qualidade e suporte multilíngue para dispositivos com 6-8GB de RAM.",
    huggingFaceId: "lmstudio-community/Llama-3.2-3B-Instruct-GGUF",
    downloadLink:
      "https://huggingface.co/lmstudio-community/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    fileSizeBytes: 2020 * 1024 * 1024,
    estimatedRamBytes: 4040 * 1024 * 1024,
    bytes: "3B",
    tags: ["alta-qualidade"],
    supportsReasoning: true,
  },

  // Phi-3 e Phi-3.5
  {
    id: "phi-3-mini-4k-instruct",
    displayName: "Phi-3 Mini",
    description:
      "Modelo de 3.8B da Microsoft, conhecido por sua excelente qualidade e desempenho impressionante para o tamanho (6-8GB RAM).",
    huggingFaceId: "bartowski/Phi-3-mini-4k-instruct-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf",
    fileSizeBytes: 2390 * 1024 * 1024,
    estimatedRamBytes: 4800 * 1024 * 1024,
    bytes: "3.8B",
    tags: ["alta-qualidade"],
    supportsReasoning: true,
  },
  {
    id: "phi-3.5-mini-instruct",
    displayName: "Phi-3.5 Mini",
    description:
      "Versão atualizada do Phi-3-mini com suporte a contexto de 128k tokens. Ótima qualidade para dispositivos com 6-8GB de RAM.",
    huggingFaceId: "bartowski/Phi-3.5-mini-instruct_Uncensored-GGUF",
    downloadLink:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct_Uncensored-GGUF/resolve/main/Phi-3.5-mini-instruct_Uncensored-Q4_K_M.gguf",
    fileSizeBytes: 2390 * 1024 * 1024,
    estimatedRamBytes: 4800 * 1024 * 1024,
    bytes: "3.8B",
    tags: ["alta-qualidade"],
    supportsReasoning: true,
  },

  // TinyLlama
  {
    id: "tinyllama-1.1b",
    displayName: "TinyLlama",
    description:
      "Modelo extremamente leve e rápido, perfeito para dispositivos com pouca RAM (< 4GB) ou para testes rápidos.",
    huggingFaceId:
      "TinyLlama/TinyLlama-1.1B-Chat-v0.6/blob/main/ggml-model-q4_0.gguf",
    downloadLink:
      "https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v0.6/resolve/main/ggml-model-q4_0.gguf",
    fileSizeBytes: 637 * 1024 * 1024,
    estimatedRamBytes: 1000 * 1024 * 1024,
    bytes: "1.1B",
    tags: ["ultra-leve"],
  },
];

/**
 * Gets the full list of available models in the catalog.
 * @returns {Model[]} Array of available models with metadata.
 */
export function getAllModels(): Model[] {
  return [...MODEL_CATALOG];
}

/**
 * Finds a model in the catalog by its ID.
 * @param id model id
 * @returns {Model | undefined} Model matching the given ID, or undefined if not found.
 */
export function findModelById(id: string): Model | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}

/**
 * Filters models by available RAM.
 * @param maxRamBytes Maximum RAM in bytes
 * @returns {Model[]} Array of models that fit within the specified RAM
 */
export function getModelsByRam(maxRamBytes: number): Model[] {
  return MODEL_CATALOG.filter(
    (model) => model.estimatedRamBytes <= maxRamBytes,
  );
}
