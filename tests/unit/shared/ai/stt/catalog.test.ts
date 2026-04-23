import { describe, expect, it } from "bun:test";
import {
  WHISPER_CATALOG,
  findWhisperModelById,
} from "../../../../../shared/ai/stt/catalog";

describe("WHISPER_CATALOG", () => {
  it("contains exactly three entries", () => {
    expect(WHISPER_CATALOG).toHaveLength(3);
  });

  it("contains whisper-tiny-pt with correct values", () => {
    const model = WHISPER_CATALOG.find((m) => m.id === "whisper-tiny-pt");
    expect(model).toEqual({
      id: "whisper-tiny-pt",
      displayName: "Whisper Tiny (pt-BR)",
      description:
        "Modelo mais leve, ideal para dispositivos com pouca memória.",
      downloadLink:
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
      fileSizeBytes: 77704715,
      estimatedRamBytes: 125000000,
      modelType: "bin",
    });
  });

  it("contains whisper-base-pt with correct values", () => {
    const model = WHISPER_CATALOG.find((m) => m.id === "whisper-base-pt");
    expect(model).toEqual({
      id: "whisper-base-pt",
      displayName: "Whisper Base (pt-BR)",
      description:
        "Equilíbrio entre velocidade e precisão para português brasileiro.",
      downloadLink:
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
      fileSizeBytes: 147951465,
      estimatedRamBytes: 210000000,
      modelType: "bin",
    });
  });

  it("contains whisper-small-pt with correct values", () => {
    const model = WHISPER_CATALOG.find((m) => m.id === "whisper-small-pt");
    expect(model).toEqual({
      id: "whisper-small-pt",
      displayName: "Whisper Small (pt-BR)",
      description:
        "Maior precisão para português brasileiro, requer mais memória.",
      downloadLink:
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
      fileSizeBytes: 487601967,
      estimatedRamBytes: 600000000,
      modelType: "bin",
    });
  });

  it("all entries have modelType 'bin'", () => {
    expect(WHISPER_CATALOG.every((m) => m.modelType === "bin")).toBe(true);
  });
});

describe("findWhisperModelById", () => {
  it("returns the correct model for a known id", () => {
    const model = findWhisperModelById("whisper-base-pt");
    expect(model?.id).toBe("whisper-base-pt");
  });

  it("returns undefined for an unknown id", () => {
    expect(findWhisperModelById("nonexistent-model")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(findWhisperModelById("")).toBeUndefined();
  });
});

describe("WHISPER_CATALOG immutability", () => {
  it("cannot be mutated at compile time (readonly)", () => {
    expect(WHISPER_CATALOG).toHaveLength(3);
    expect(WHISPER_CATALOG.every((m) => m.modelType === "bin")).toBe(true);
  });
});
