import { WhisperModel } from "./types";

export const WHISPER_CATALOG: readonly WhisperModel[] = [
  {
    id: "whisper-tiny-pt",
    displayName: "Whisper Tiny (pt-BR)",
    description: "Modelo mais leve, ideal para dispositivos com pouca memória.",
    downloadLink:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    fileSizeBytes: 77_704_715,
    estimatedRamBytes: 125_000_000,
    modelType: "bin",
  },
  {
    id: "whisper-base-pt",
    displayName: "Whisper Base (pt-BR)",
    description:
      "Equilíbrio entre velocidade e precisão para português brasileiro.",
    downloadLink:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    fileSizeBytes: 147_951_465,
    estimatedRamBytes: 210_000_000,
    modelType: "bin",
  },
  {
    id: "whisper-small-pt",
    displayName: "Whisper Small (pt-BR)",
    description:
      "Maior precisão para português brasileiro, requer mais memória.",
    downloadLink:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    fileSizeBytes: 487_601_967,
    estimatedRamBytes: 600_000_000,
    modelType: "bin",
  },
];

export function findWhisperModelById(id: string): WhisperModel | undefined {
  return WHISPER_CATALOG.find((m) => m.id === id);
}
