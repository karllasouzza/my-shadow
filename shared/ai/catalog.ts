/**
 * Model Catalog
 *
 * Catálogo de modelos GGUF disponíveis para download.
 * IDs no formato HuggingFace: "owner/repo/file.gguf"
 */

import type { ModelCatalogEntry } from "./types";

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // TinyLlama / Llama 2 based
  {
    id: "samba-1.1b",
    displayName: "Samba 1.1B",
    description:
      "Modelo leve baseado no TinyLlama, treinado especificamente para o português. Ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId: "mradermacher/samba-1.1B-GGUF/samba-1.1B.Q4_K_M.gguf",
    fileSizeBytes: 668 * 1024 * 1024,
    estimatedRamBytes: 1000 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "1.1B",
    tags: ["ultra-leve", "português", "baixa-ram"],
  },
  {
    id: "cabrita-3b",
    displayName: "Cabrita 3B",
    description:
      "Modelo de código aberto para português, baseado no Open-LLaMA 3B. Boa opção para dispositivos com 4-6GB de RAM.",
    huggingFaceId: "lucianosb/open-cabrita3b-GGUF/opencabrita3b-q4_1.gguf",
    fileSizeBytes: 1900 * 1024 * 1024,
    estimatedRamBytes: 3500 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "3B",
    tags: ["equilibrado", "português", "ram-moderada"],
  },

  // Phi-3 based
  {
    id: "phi-3-portuguese-tom-cat-4k",
    displayName: "Phi-3 Portuguese Tom Cat",
    description:
      "Microsoft Phi-3-mini otimizado para português com 300k instruções. Ótimo custo-benefício para 6-8GB de RAM.",
    huggingFaceId:
      "noxinc/phi-3-portuguese-tom-cat-4k-instruct-Q4_K_M-GGUF-PTBR/phi-3-portuguese-tom-cat-4k-instruct.Q4_K_M.gguf",
    fileSizeBytes: 2300 * 1024 * 1024, // ~2.3 GB
    estimatedRamBytes: 4200 * 1024 * 1024, // ~4.2 GB
    quantization: "Q4_K_M",
    bytes: "3.8B",
    tags: ["alta-qualidade", "português", "instrutor", "ram-moderada"],
    supportsReasoning: true,
  },
  {
    id: "phi-bode-3b",
    displayName: "Phi-Bode 3B",
    description:
      "Combinação do modelo Bode com a arquitetura eficiente Phi-3. Excelente para português em dispositivos com 4-6GB de RAM.",
    huggingFaceId: "dagbs/Phi-Bode-GGUF/Phi-Bode.Q2_K.gguf",
    fileSizeBytes: 1900 * 1024 * 1024, // ~1.9 GB
    estimatedRamBytes: 3500 * 1024 * 1024, // ~3.5 GB
    quantization: "Q4_K_M",
    bytes: "3B",
    tags: ["equilibrado", "português", "instrutor", "ram-moderada"],
  },

  // LLaMA 3 based
  {
    id: "llama-3-portuguese-tom-cat-8b",
    displayName: "Llama 3 Portuguese Tom Cat",
    description:
      "Llama 3 8B adaptado para o português com 300k diálogos. Alta qualidade para tarefas complexas (8GB+ RAM).",
    huggingFaceId:
      "mradermacher/Llama-3-portuguese-Tom-cat-8b-instruct-i1-GGUF/Llama-3-portuguese-Tom-cat-8b-instruct.i1-IQ1_S.gguf",
    fileSizeBytes: 4500 * 1024 * 1024, // ~4.5 GB
    estimatedRamBytes: 7000 * 1024 * 1024, // ~7.0 GB
    quantization: "Q4_K_M",
    bytes: "8B",
    tags: ["alta-qualidade", "português", "instrutor", "alta-ram"],
    supportsReasoning: true,
  },

  // Periquito e Sabiá
  {
    id: "periquito-3b",
    displayName: "Periquito 3B",
    description:
      "Modelo de 3B parâmetros treinado do zero em português. Boa opção para dispositivos com 4-6GB de RAM.",
    huggingFaceId:
      "mradermacher/periquito-3B-i1-GGUF/periquito-3B.i1-IQ1_M.gguf",
    fileSizeBytes: 1800 * 1024 * 1024, // ~1.8 GB
    estimatedRamBytes: 3300 * 1024 * 1024, // ~3.3 GB
    quantization: "Q4_0",
    bytes: "3B",
    tags: ["equilibrado", "português", "ram-moderada"],
  },
  {
    id: "sabia-7b",
    displayName: "Sabiá 7B",
    description:
      "Um dos primeiros grandes modelos de linguagem treinados especificamente para o português. Requer 8GB+ de RAM.",
    huggingFaceId: "lucianosb/sabia-7b-GGUF/sabia7b-q4_0.gguf",
    fileSizeBytes: 4000 * 1024 * 1024, // ~4.0 GB
    estimatedRamBytes: 6500 * 1024 * 1024, // ~6.5 GB
    quantization: "Q4_0",
    bytes: "7B",
    tags: ["alta-qualidade", "português", "alta-ram"],
  },

  // QWEN 2.5
  {
    id: "qwen2.5-0.5b-instruct",
    displayName: "Qwen 2.5",
    description:
      "Modelo leve e rápido, ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId:
      "Sekinna/Qwen2.5-0.5B-Instruct-GGUF/qwen2.5-0.5b-instruct-q2_k.gguf",
    fileSizeBytes: 350 * 1024 * 1024,
    estimatedRamBytes: 600 * 1024 * 1024,
    quantization: "Q2_K",
    bytes: "0.5B",
    tags: ["ultra-leve", "instrutor", "rápido", "baixa-ram"],
  },
  {
    id: "qwen2.5-1.5b-instruct",
    displayName: "Qwen 2.5",
    description:
      "Equilíbrio entre qualidade e desempenho para a maioria dos dispositivos (4-6GB RAM).",
    huggingFaceId:
      "bartowski/Qwen2.5-1.5B-Instruct-GGUF/Qwen2.5-1.5B-Instruct-Q4_0.gguf",
    fileSizeBytes: 938 * 1024 * 1024,
    estimatedRamBytes: 1800 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "1.5B",
    tags: ["equilibrado", "instrutor", "ram-moderada"],
  },
  {
    id: "qwen2.5-3b-instruct",
    displayName: "Qwen 2.5",
    description:
      "Modelo de maior qualidade, recomendado para dispositivos com 8GB+ de RAM.",
    huggingFaceId:
      "bartowski/Qwen2.5-3B-Instruct-GGUF/Qwen2.5-3B-Instruct-Q4_0.gguf",
    fileSizeBytes: 1830 * 1024 * 1024,
    estimatedRamBytes: 3500 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "3B",
    tags: ["alta-qualidade", "instrutor", "alta-ram"],
  },
  // QWEN 3
  {
    id: "qwen3-0.6b",
    displayName: "Qwen 3",
    description:
      "Modelo extremamente leve da família Qwen 3 para dispositivos com pouca RAM.",
    huggingFaceId: "bartowski/Qwen_Qwen3-0.6B-GGUF/Qwen_Qwen3-0.6B-Q4_0.gguf",
    fileSizeBytes: 430 * 1024 * 1024,
    estimatedRamBytes: 800 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "0.6B",
    tags: ["ultra-leve", "instrutor", "baixa-ram"],
    supportsReasoning: true,
  },
  {
    id: "qwen3-1.7b",
    displayName: "Qwen 3",
    description:
      "Boa opção intermediária da família Qwen 3 para uso geral local.",
    huggingFaceId: "bartowski/Qwen_Qwen3-1.7B-GGUF/Qwen3-1.7B-Q4_0.gguf",
    fileSizeBytes: 1100 * 1024 * 1024, // ~1.1 GB
    estimatedRamBytes: 2200 * 1024 * 1024, // ~2.2 GB
    quantization: "Q4_0",
    bytes: "1.7B",
    tags: ["equilibrado", "instrutor", "ram-moderada"],
    supportsReasoning: true,
  },
  {
    id: "qwen3-4b",
    displayName: "Qwen 3",
    description:
      "Modelo maior da família Qwen 3, com melhor qualidade e maior exigência de memória.",
    huggingFaceId: "bartowski/Qwen_Qwen3-4B-GGUF/Qwen3-4B-Q4_0.gguf",
    fileSizeBytes: 2380 * 1024 * 1024, // ~2.38 GB
    estimatedRamBytes: 4500 * 1024 * 1024, // ~4.5 GB
    quantization: "Q4_0",
    bytes: "4B",
    tags: ["alta-qualidade", "instrutor", "alta-ram"],
    supportsReasoning: true,
  },
  // Gemma 2
  {
    id: "gemma-2-2b-it",
    displayName: "Gemma 2",
    description:
      "Modelo equilibrado e moderno do Google, com excelente compreensão de instruções para dispositivos com 4-6GB de RAM.",
    huggingFaceId: "tensorblock/gemma-2b-it-GGUF/gemma-2b-it-Q2_K.gguf",
    fileSizeBytes: 1160 * 1024 * 1024,
    estimatedRamBytes: 2300 * 1024 * 1024,
    quantization: "Q2_K",
    bytes: "2B",
    tags: ["equilibrado", "instrutor", "google", "ram-moderada"],
  },

  // Gemma 3
  {
    id: "gemma-3-1b-it",
    displayName: "Gemma 3",
    description:
      "Modelo extremamente leve do Google, ideal para dispositivos com pouca RAM (< 4GB).",
    huggingFaceId: "unsloth/gemma-3-1b-it-GGUF/gemma-3-1b-it-Q4_0.gguf",
    fileSizeBytes: 722 * 1024 * 1024,
    estimatedRamBytes: 1400 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "1B",
    tags: ["ultra-leve", "instrutor", "google", "baixa-ram"],
    supportsReasoning: true,
  },
  {
    id: "gemma-3-4b-it",
    displayName: "Gemma 3",
    description:
      "Modelo de alta qualidade do Google, recomendado para dispositivos com 8GB+ de RAM. Suporta raciocínio (reasoning).",
    huggingFaceId: "unsloth/gemma-3-4b-it-GGUF/gemma-3-4b-it-Q4_K_M.gguf", // ~2.4 GB (estimado)
    fileSizeBytes: 2490 * 1024 * 1024,
    estimatedRamBytes: 4500 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "4B",
    tags: ["alta-qualidade", "instrutor", "google", "alta-ram"],
    supportsReasoning: true,
  },

  // DeepSeek R1 Destilado (Distilled)
  {
    id: "deepseek-r1-distill-qwen-1.5b",
    displayName: "DeepSeek R1",
    description:
      "Modelo com capacidade de raciocínio (reasoning), destilado do DeepSeek R1. Muito capaz para seu tamanho (4-6GB RAM).",
    huggingFaceId:
      "lmstudio-community/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    fileSizeBytes: 1100 * 1024 * 1024,
    estimatedRamBytes: 2200 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "1.5B",
    tags: ["equilibrado", "reasoning", "deepseek", "ram-moderada"],
    supportsReasoning: true,
  },
  {
    id: "deepseek-r1-distill-qwen-7b",
    displayName: "DeepSeek R1",
    description:
      "Modelo de raciocínio destilado do DeepSeek R1, com excelente qualidade para tarefas complexas (8GB+ RAM).",
    huggingFaceId:
      "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
    fileSizeBytes: 4680 * 1024 * 1024,
    estimatedRamBytes: 7000 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "7B",
    tags: ["alta-qualidade", "reasoning", "deepseek", "alta-ram"],
    supportsReasoning: true,
  },
  {
    id: "deepseek-r1-distill-llama-8b",
    displayName: "DeepSeek R1",
    description:
      "Variante destilada do DeepSeek R1 baseada no Llama 3.1 8B. Excelente qualidade para tarefas complexas (8GB+ RAM).",
    huggingFaceId:
      "unsloth/DeepSeek-R1-Distill-Llama-8B-GGUF/DeepSeek-R1-Distill-Llama-8B-Q4_K_M.gguf",
    fileSizeBytes: 4920 * 1024 * 1024,
    estimatedRamBytes: 7500 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "8B",
    tags: ["alta-qualidade", "reasoning", "deepseek", "alta-ram"],
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
    fileSizeBytes: 808 * 1024 * 1024,
    estimatedRamBytes: 1200 * 1024 * 1024,
    quantization: "Q3_M",
    bytes: "1B",
    tags: ["ultra-leve", "instrutor", "meta", "baixa-ram"],
    supportsReasoning: true,
  },
  {
    id: "llama-3.2-3b-instruct",
    displayName: "Llama 3.2",
    description:
      "Modelo de 3B da Meta, oferecendo ótima qualidade e suporte multilíngue para dispositivos com 6-8GB de RAM.",
    huggingFaceId:
      "lmstudio-community/Llama-3.2-3B-Instruct-GGUF/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    fileSizeBytes: 2020 * 1024 * 1024,
    estimatedRamBytes: 3800 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "3B",
    tags: ["alta-qualidade", "instrutor", "meta", "alta-ram"],
    supportsReasoning: true,
  },

  // Phi-3 e Phi-3.5
  {
    id: "phi-3-mini-4k-instruct",
    displayName: "Phi-3 Mini",
    description:
      "Modelo de 3.8B da Microsoft, conhecido por sua excelente qualidade e desempenho impressionante para o tamanho (6-8GB RAM).",
    huggingFaceId:
      "bartowski/Phi-3-mini-4k-instruct-GGUF/Phi-3-mini-4k-instruct-Q4_K_M.gguf", // ~2.2 GB
    fileSizeBytes: 2200 * 1024 * 1024,
    estimatedRamBytes: 4000 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "3.8B",
    tags: ["alta-qualidade", "instrutor", "microsoft", "ram-moderada"],
    supportsReasoning: true,
  },
  {
    id: "phi-3.5-mini-instruct",
    displayName: "Phi-3.5 Mini",
    description:
      "Versão atualizada do Phi-3-mini com suporte a contexto de 128k tokens. Ótima qualidade para dispositivos com 6-8GB de RAM.",
    huggingFaceId:
      "bartowski/Phi-3.5-mini-instruct_Uncensored-GGUF/Phi-3.5-mini-instruct_Uncensored-Q4_K_M.gguf",
    fileSizeBytes: 2400 * 1024 * 1024,
    estimatedRamBytes: 4200 * 1024 * 1024,
    quantization: "Q4_K_M",
    bytes: "3.8B",
    tags: ["alta-qualidade", "instrutor", "microsoft", "ram-moderada"],
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
    fileSizeBytes: 637 * 1024 * 1024,
    estimatedRamBytes: 1000 * 1024 * 1024,
    quantization: "Q4_0",
    bytes: "1.1B",
    tags: ["ultra-leve", "base", "rapido", "baixa-ram"],
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
