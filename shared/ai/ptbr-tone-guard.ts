/**
 * T017: Implement pt-BR language and Jungian tone guard utilities
 * 
 * Validates that generated content is in Brazilian Portuguese and maintains
 * appropriate Jungian introspective tone throughout the application.
 */

import { Result, ok, err, createError } from "../utils/app-error";

export interface ToneValidationResult {
  isValid: boolean;
  score: number; // 0-1
  issues: string[];
}

export interface LanguageDetectionResult {
  isPtBR: boolean;
  confidence: number; // 0-1
  detectedLanguage?: string;
}

/**
 * Utility for validating Portuguese (Brazil) language content
 */
export class PtBRLanguageGuard {
  /**
   * Detect if content is in Portuguese (Brazil)
   */
  detectLanguage(text: string): LanguageDetectionResult {
    // Simple heuristic detection - in production use a proper language detection library
    const ptBRIndicators = [
      /\b(não|você|é|da|de|para|com|em|por)\b/gi, // Common Portuguese words
      /[áàâãéèêíìîóòôõöúùûü]/g, // Portuguese diacritics
      /\b(bem|muito|coisa|pessoa|dia|ano|vez)\b/gi, // Common PT-BR words
    ];

    let matchCount = 0;
    for (const pattern of ptBRIndicators) {
      const matches = text.match(pattern);
      if (matches) {
        matchCount += matches.length;
      }
    }

    // Check for English indicators (negative)
    const englishIndicators = [
      /\b(the|and|is|with|this|that|have|been)\b/gi,
    ];

    let englishCount = 0;
    for (const pattern of englishIndicators) {
      const matches = text.match(pattern);
      if (matches) {
        englishCount += matches.length;
      }
    }

    const totalWords = text.split(/\s+/).length;
    const confidence = Math.min(
      1,
      matchCount / (totalWords * 0.1) - (englishCount * 0.2)
    );

    return {
      isPtBR: confidence > 0.5,
      confidence,
      detectedLanguage: confidence > 0.5 ? "pt-BR" : "unknown",
    };
  }

  /**
   * Validate that text is in Portuguese (Brazil)
   */
  validateLanguage(text: string): Result<void> {
    const detection = this.detectLanguage(text);

    if (!detection.isPtBR) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Content must be in Brazilian Portuguese",
          { confidence: detection.confidence }
        )
      );
    }

    return ok(void 0);
  }
}

/**
 * Utility for validating Jungian introspective tone
 */
export class JungianToneGuard {
  private redFlags = [
    /\b(lixo|estúpido|idiota|fraco|fracasso)\b/gi, // Harsh self-criticism
    /\b(nunca|sempre|totalmente|completamente)\b/gi, // Absolute statements when used with negatives
  ];

  private positiveIndicators = [
    /\b(entender|aceitar|integração|sombra|crescimento|consciência)\b/gi,
    /\b(compaixão|cuidado|gentileza|autorreflex|insight)\b/gi,
  ];

  /**
   * Validate tone for Jungian introspective work
   */
  validateTone(text: string): ToneValidationResult {
    const issues: string[] = [];
    let redFlagCount = 0;
    let positiveIndicatorCount = 0;

    // Check for red flags
    for (const pattern of this.redFlags) {
      const matches = text.match(pattern);
      if (matches) {
        redFlagCount += matches.length;
        issues.push(`Detectada linguagem de auto-crítica severa: ${matches[0]}`);
      }
    }

    // Check for positive indicators
    for (const pattern of this.positiveIndicators) {
      const matches = text.match(pattern);
      if (matches) {
        positiveIndicatorCount += matches.length;
      }
    }

    // Calculate tone score (0-1)
    const totalWords = text.split(/\s+/).length;
    const normalizedRedFlags = redFlagCount / totalWords;
    const normalizedPositive = positiveIndicatorCount / totalWords;

    let score = 0.5; // Baseline
    score -= normalizedRedFlags * 0.3; // Penalize red flags
    score += normalizedPositive * 0.2; // Reward positive indicators
    score = Math.max(0, Math.min(1, score)); // Clamp 0-1

    const isValid =
      redFlagCount <= 2 && // Allow some harsh language in context
      score > 0.3; // Overall tone should lean positive/integrative

    return {
      isValid,
      score,
      issues,
    };
  }
}

/**
 * Combined language + tone guard
 */
export class PtBRJungianGuard {
  private languageGuard = new PtBRLanguageGuard();
  private toneGuard = new JungianToneGuard();

  /**
   * Validate both language and tone
   */
  validate(text: string): Result<{ language: LanguageDetectionResult; tone: ToneValidationResult }> {
    const languageValidation = this.languageGuard.validateLanguage(text);
    if (!languageValidation.success) {
      return err(languageValidation.error);
    }

    const toneResult = this.toneGuard.validateTone(text);

    if (!toneResult.isValid) {
      return err(
        createError(
          "VALIDATION_ERROR",
          "Content does not maintain appropriate introspective tone",
          { issues: toneResult.issues, score: toneResult.score }
        )
      );
    }

    const languageDetection = this.languageGuard.detectLanguage(text);

    return ok({
      language: languageDetection,
      tone: toneResult,
    });
  }

  /**
   * Analyze without failing on tone
   */
  analyze(text: string): {
    language: LanguageDetectionResult;
    tone: ToneValidationResult;
  } {
    return {
      language: this.languageGuard.detectLanguage(text),
      tone: this.toneGuard.validateTone(text),
    };
  }
}

// Singletons
let languageGuard: PtBRLanguageGuard;
let toneGuard: JungianToneGuard;
let combinedGuard: PtBRJungianGuard;

export const getPtBRLanguageGuard = (): PtBRLanguageGuard => {
  if (!languageGuard) {
    languageGuard = new PtBRLanguageGuard();
  }
  return languageGuard;
};

export const getJungianToneGuard = (): JungianToneGuard => {
  if (!toneGuard) {
    toneGuard = new JungianToneGuard();
  }
  return toneGuard;
};

export const getPtBRJungianGuard = (): PtBRJungianGuard => {
  if (!combinedGuard) {
    combinedGuard = new PtBRJungianGuard();
  }
  return combinedGuard;
};
