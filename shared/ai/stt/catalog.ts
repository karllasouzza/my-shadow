import { getAllModels } from "../text-generation/catalog";
import { ModelType } from "../types/manager";
import { Model } from "../types/model";
import { WhisperModel } from "./types";

export const WHISPER_CATALOG: WhisperModel[] = [
  {
    id: "whisper-tiny-pt",
    displayName: "Whisper Tiny (pt-BR)",
    description: "Modelo mais leve, ideal para dispositivos com pouca memória.",
    downloadLink:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    fileSizeBytes: 77704715,
    estimatedRamBytes: 125000000,
    modelType: "bin",
  },
  {
    id: "whisper-base-pt",
    displayName: "Whisper Base (pt-BR)",
    description:
      "Equilíbrio entre velocidade e precisão para português brasileiro.",
    downloadLink:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    fileSizeBytes: 147951465,
    estimatedRamBytes: 210000000,
    modelType: "bin",
  },
  {
    id: "whisper-small-pt",
    displayName: "Whisper Small (pt-BR)",
    description:
      "Maior precisão para português brasileiro, requer mais memória.",
    downloadLink:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    fileSizeBytes: 487601967,
    estimatedRamBytes: 600000000,
    modelType: "bin",
  },
];

/**
 * Finds a Whisper model in the catalog by its ID.
 * @param id The model ID to search for
 * @returns The matching WhisperModel, or undefined if not found
 */
export function findWhisperModelById(id: string): WhisperModel | undefined {
  return WHISPER_CATALOG.find((model) => model.id === id);
}

/**
 * Returns all Whisper models in the catalog.
 * @returns Array of all WhisperModel entries
 */
export function getAllWhisperModels(): WhisperModel[] {
  return [...WHISPER_CATALOG];
}

/**
 * Returns all models (LLM + Whisper) filtered by the given ModelType.
 * @param type The model type to filter by ("gguf" or "bin")
 * @returns Array of models matching the specified type
 */
export function getModelsByType(type: ModelType): (Model | WhisperModel)[] {
  const llmModels = getAllModels().filter((m) => m.modelType === type);
  const whisperModels = WHISPER_CATALOG.filter((m) => m.modelType === type);
  return [...llmModels, ...whisperModels];
}
