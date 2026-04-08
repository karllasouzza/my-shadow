/**
 * T013: Implement Portuguese fallback prompt provider
 *
 * Provides fallback guided questions and review templates in Brazilian Portuguese
 * when local generation is unavailable.
 */

export interface FallbackPromptSet {
  questions: string[];
  reviewTemplate: string;
  emotionalTriggerPrompts: string[];
  patternIdentificationPrompts: string[];
}

/**
 * Service providing fallback prompts in Brazilian Portuguese
 */
export class FallbackPromptProvider {
  /**
   * Get fallback guided questions for reflection
   */
  getGuidedQuestionsFallback(): string[] {
    return [
      "O que você sente em relação ao que escreveu?",
      "Existem padrões que você reconhece nesta reflexão?",
      "Como você poderia responder com mais compaixão a isso?",
      "O que este sentimento está tentando lhe dizer?",
      "Qual é uma primeira ação pequena que você poderia tomar?",
      "Como você poderia se apoiar através disso?",
    ];
  }

  /**
   * Get fallback final review summary template
   */
  getFinalReviewTemplateFallback(
    periodStart: string,
    periodEnd: string,
  ): string {
    return `
# Revisão do Período: ${periodStart} a ${periodEnd}

## Resumo do Período
Durante este período, você refletiu sobre suas experiências internas e externas, cultivando maior consciência de si mesmo.

## Padrões Recorrentes
Observar padrões em nossas reflexões nos ajuda a entender ciclos emocionais e comportamentais.

## Reconhecimentos
Reconheça o tempo e a atenção que dedicou a compreender-se melhor durante este período.

## Próximos Passos
Considere como as percepções deste período podem informar seu crescimento contínuo.
    `.trim();
  }

  /**
   * Get fallback emotional trigger prompts
   */
  getEmotionalTriggerPrompts(): string[] {
    return [
      "Relações pessoais e conexão",
      "Desafios nas atividades diárias",
      "Bem-estar e saúde pessoal",
      "Objetivos e aspirações",
      "Conflitos internos e externos",
    ];
  }

  /**
   * Get fallback pattern identification prompts
   */
  getPatternIdentificationPrompts(): string[] {
    return [
      "Padrões de pensamento recorrentes",
      "Ciclos emocionais que se repetem",
      "Respostas automáticas e reações",
      "Crenças profundas que influenciam suas ações",
      "Conexões entre eventos e emoções",
    ];
  }

  /**
   * Get complete fallback prompt set
   */
  getCompleteFallbackSet(
    periodStart?: string,
    periodEnd?: string,
  ): FallbackPromptSet {
    return {
      questions: this.getGuidedQuestionsFallback(),
      reviewTemplate: this.getFinalReviewTemplateFallback(
        periodStart || new Date().toISOString().split("T")[0],
        periodEnd || new Date().toISOString().split("T")[0],
      ),
      emotionalTriggerPrompts: this.getEmotionalTriggerPrompts(),
      patternIdentificationPrompts: this.getPatternIdentificationPrompts(),
    };
  }
}

// Singleton instance
let providerInstance: FallbackPromptProvider;

export const getFallbackPromptProvider = (): FallbackPromptProvider => {
  if (!providerInstance) {
    providerInstance = new FallbackPromptProvider();
  }
  return providerInstance;
};
