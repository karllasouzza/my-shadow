import { describe, expect, it } from "bun:test";
import {
    WHISPER_CATALOG,
    findWhisperModelById,
    getAllWhisperModels,
    getModelsByType,
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

describe("getAllWhisperModels", () => {
  it("returns all three whisper models", () => {
    const models = getAllWhisperModels();
    expect(models).toHaveLength(3);
  });

  it("returns a copy — mutations do not affect the catalog", () => {
    const models = getAllWhisperModels();
    models.pop();
    expect(WHISPER_CATALOG).toHaveLength(3);
  });
});

describe("getModelsByType", () => {
  it("returns only 'bin' models when type is 'bin'", () => {
    const models = getModelsByType("bin");
    expect(models.every((m) => m.modelType === "bin")).toBe(true);
  });

  it("returns all three whisper models when type is 'bin'", () => {
    const models = getModelsByType("bin");
    const ids = models.map((m) => m.id);
    expect(ids).toContain("whisper-tiny-pt");
    expect(ids).toContain("whisper-base-pt");
    expect(ids).toContain("whisper-small-pt");
  });

  it("returns only 'gguf' models when type is 'gguf'", () => {
    const models = getModelsByType("gguf");
    expect(models.every((m) => m.modelType === "gguf")).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("returns no whisper models when type is 'gguf'", () => {
    const models = getModelsByType("gguf");
    const ids = models.map((m) => m.id);
    expect(ids).not.toContain("whisper-tiny-pt");
    expect(ids).not.toContain("whisper-base-pt");
    expect(ids).not.toContain("whisper-small-pt");
  });
});
