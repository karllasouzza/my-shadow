/**
 * T019: Unit tests for reflection validation and language guard
 */

import {
    getPtBRJungianGuard,
    getPtBRLanguageGuard,
} from "../../../shared/ai/ptbr-tone-guard";

describe("PtBR Language Guard", () => {
  const guard = getPtBRLanguageGuard();

  describe("detectLanguage", () => {
    it("should detect Brazilian Portuguese", () => {
      const text = "Eu reflito sobre meus sentimentos e emoções profundas.";
      const result = guard.detectLanguage(text);
      expect(result.isPtBR).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should detect non-Portuguese text", () => {
      const text = "I am reflecting on my deep feelings and emotions.";
      const result = guard.detectLanguage(text);
      expect(result.isPtBR).toBe(false);
      expect(result.detectedLanguage).not.toBe("pt-BR");
    });
  });

  describe("validateLanguage", () => {
    it("should validate Portuguese text", () => {
      const text = "Sinto gratidão pela vida que tenho.";
      const result = guard.validateLanguage(text);
      expect(result.success).toBe(true);
    });

    it("should reject English text", () => {
      const text = "I feel grateful for the life I have.";
      const result = guard.validateLanguage(text);
      expect(result.success).toBe(false);
    });
  });
});

describe("Jungian Tone Guard", () => {
  const guard = getPtBRJungianGuard();

  describe("validateTone", () => {
    it("should validate introspective tone", () => {
      const text =
        "Reconheço meus sentimentos e aceito minha sombra com compaixão.";
      const result = guard.analyze(text);
      expect(result.tone.isValid).toBe(true);
      expect(result.tone.score).toBeGreaterThan(0.3);
    });

    it("should flag harsh self-criticism", () => {
      const text = "Sou um idiota e um fracasso completo.";
      const result = guard.analyze(text);
      expect(result.tone.issues.length).toBeGreaterThan(0);
    });

    it("should reward integrative language", () => {
      const text = "Integro minha sombra através da consciência e autorreflex.";
      const result = guard.analyze(text);
      expect(result.tone.score).toBeGreaterThan(0.5);
    });
  });
});

describe("Combined Guard", () => {
  const guard = getPtBRJungianGuard();

  it("should validate both language and tone", () => {
    const text =
      "Reflito com compaixão sobre minhas emoções e reconheço meu crescimento.";
    const result = guard.validate(text);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language.isPtBR).toBe(true);
      expect(result.data.tone.isValid).toBe(true);
    }
  });

  it("should fail on language validation", () => {
    const text =
      "I reflect with compassion on my emotions and recognize my growth.";
    const result = guard.validate(text);
    expect(result.success).toBe(false);
  });
});
