/**
 * T039: Final review generation service
 *
 * Orchestrates review generation from reflection set with support for normal,
 * fallback, and retry modes.
 */

import { getFallbackPromptProvider } from "../../../shared/ai/fallback-prompts-ptbr";
import { getLocalAIRuntime } from "../../../shared/ai/local-ai-runtime";
import { getPtBRJungianGuard } from "../../../shared/ai/ptbr-tone-guard";
import { getGenerationJobStore } from "../../../shared/storage/generation-job-store";
import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { getReflectionRepository } from "../../reflection/repository/reflection-repository";
import { FinalReview } from "../model/final-review";
import { getReviewRepository } from "../repository/review-repository";

interface ParsedReviewOutput {
  summary: string;
  patterns: string[];
  triggers: string[];
  prompts: string[];
}

export class ReviewService {
  private reviewRepository = getReviewRepository();
  private reflectionRepository = getReflectionRepository();
  private fallbackProvider = getFallbackPromptProvider();
  private toneGuard = getPtBRJungianGuard();
  private jobStore = getGenerationJobStore();

  /**
   * Generate final review for period
   */
  async generateFinalReview(
    periodStart: string,
    periodEnd: string,
    reflectionIds: string[],
  ): Promise<
    Result<{
      id: string;
      summary: string;
      patterns: string[];
      triggers: string[];
      prompts: string[];
    }>
  > {
    try {
      if (reflectionIds.length === 0) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Cannot generate review without reflections",
          ),
        );
      }

      const reflectionContents =
        await this.loadReflectionContents(reflectionIds);
      if (reflectionContents.length === 0) {
        return err(
          createError(
            "NOT_FOUND",
            "No reflection content available for selected period",
            { periodStart, periodEnd },
          ),
        );
      }

      const runtime = getLocalAIRuntime();
      const runtimeInit = await runtime.initialize();

      let parsedOutput: ParsedReviewOutput | null = null;
      if (runtimeInit.success) {
        await runtime.waitReady();
        await runtime.loadModel("qwen2.5-0.5b-quantized", "");

        const completionResult = await runtime.generateCompletion([
          {
            role: "system",
            content:
              "Voce sintetiza reflexoes em portugues do Brasil com tom junguiano, acolhedor e nao diretivo.",
          },
          {
            role: "user",
            content: this.buildReviewPrompt(
              periodStart,
              periodEnd,
              reflectionContents,
            ),
          },
        ]);

        if (completionResult.success) {
          parsedOutput = this.parseReviewOutput(completionResult.data.text);
          if (parsedOutput) {
            const toneValidation = this.toneGuard.validate(
              parsedOutput.summary,
            );
            if (!toneValidation.success) {
              parsedOutput = null;
            }
          }
        }
      }

      const modelId = runtime.getCurrentModel()?.id ?? "qwen2.5-0.5b-quantized";

      const finalOutput =
        parsedOutput ??
        this.buildFallbackOutput(
          periodStart,
          periodEnd,
          reflectionContents.length,
        );

      const generationMode = parsedOutput ? "normal" : "fallback_template";

      const result = FinalReview.create(
        periodStart,
        periodEnd,
        reflectionIds,
        finalOutput.summary,
        finalOutput.patterns,
        finalOutput.triggers,
        finalOutput.prompts,
        generationMode,
        modelId,
        "llama.rn-0.10",
      );

      if (!result.success) {
        return err(result.error);
      }

      const review = result.data;
      await this.reviewRepository.save(review.toRecord());

      if (!parsedOutput) {
        await this.jobStore.createJob("final_review", review.id, 3);
      }

      return ok({
        id: review.id,
        summary: review.summary,
        patterns: review.recurringPatterns,
        triggers: review.emotionalTriggers,
        prompts: review.nextInquiryPrompts,
      });
    } catch (error) {
      return err(
        createError(
          "STORAGE_ERROR",
          `Failed to generate review: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  private async loadReflectionContents(
    reflectionIds: string[],
  ): Promise<string[]> {
    const contents: string[] = [];

    for (const reflectionId of reflectionIds) {
      const reflectionResult =
        await this.reflectionRepository.getById(reflectionId);
      if (reflectionResult.success && reflectionResult.data?.content) {
        contents.push(reflectionResult.data.content.trim());
      }
    }

    return contents.filter((content) => content.length > 0);
  }

  private buildReviewPrompt(
    periodStart: string,
    periodEnd: string,
    reflectionContents: string[],
  ): string {
    const numberedReflections = reflectionContents
      .map((content, index) => {
        const compact = content.replace(/\s+/g, " ").trim();
        return `${index + 1}. ${compact.slice(0, 900)}`;
      })
      .join("\n");

    return [
      `Periodo: ${periodStart} ate ${periodEnd}`,
      "Tarefa: sintetizar padroes recorrentes, gatilhos emocionais e proximas investigacoes.",
      "Regras:",
      "- Responder somente em pt-BR.",
      "- Nao inventar fatos alem das reflexoes fornecidas.",
      "- Manter tom introspectivo, acolhedor e nao-diretivo.",
      "Formato obrigatorio:",
      "RESUMO:",
      "texto",
      "PADROES:",
      "- item",
      "GATILHOS:",
      "- item",
      "PROMPTS:",
      "- pergunta?",
      "Reflexoes:",
      numberedReflections,
    ].join("\n");
  }

  private parseReviewOutput(text: string): ParsedReviewOutput | null {
    const normalized = text.replace(/\r/g, "");
    const summary = this.extractSection(normalized, "RESUMO:", "PADROES:");
    const patternsBlock = this.extractSection(
      normalized,
      "PADROES:",
      "GATILHOS:",
    );
    const triggersBlock = this.extractSection(
      normalized,
      "GATILHOS:",
      "PROMPTS:",
    );
    const promptsBlock = this.extractSection(normalized, "PROMPTS:");

    const patterns = this.parseBulletList(patternsBlock);
    const triggers = this.parseBulletList(triggersBlock);
    const prompts = this.parseBulletList(promptsBlock).map((item) =>
      item.endsWith("?") ? item : `${item}?`,
    );

    if (!summary || prompts.length === 0) {
      return null;
    }

    return {
      summary,
      patterns,
      triggers,
      prompts,
    };
  }

  private buildFallbackOutput(
    periodStart: string,
    periodEnd: string,
    reflectionCount: number,
  ): ParsedReviewOutput {
    const constrainedSummary =
      reflectionCount <= 1
        ? `No periodo ${periodStart} a ${periodEnd}, ha poucos dados para conclusoes amplas. Ainda assim, sua reflexao oferece um ponto importante para aprofundamento consciente.`
        : `No periodo ${periodStart} a ${periodEnd}, suas ${reflectionCount} reflexoes mostram linhas iniciais de autoconhecimento. O volume atual sugere leitura exploratoria, sem generalizacoes definitivas.`;

    return {
      summary: constrainedSummary,
      patterns: this.fallbackProvider
        .getPatternIdentificationPrompts()
        .slice(0, 3),
      triggers: this.fallbackProvider.getEmotionalTriggerPrompts().slice(0, 3),
      prompts: this.fallbackProvider.getGuidedQuestionsFallback().slice(0, 3),
    };
  }

  private extractSection(
    text: string,
    startMarker: string,
    endMarker?: string,
  ): string {
    const start = text.indexOf(startMarker);
    if (start < 0) {
      return "";
    }

    const startIndex = start + startMarker.length;
    const endIndex = endMarker ? text.indexOf(endMarker, startIndex) : -1;
    const section =
      endIndex >= 0 ? text.slice(startIndex, endIndex) : text.slice(startIndex);
    return section.trim();
  }

  private parseBulletList(section: string): string[] {
    return section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^(\d+[).:-]|[-*])\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Get existing review
   */
  async getReview(
    reviewId: string,
  ): Promise<Result<{ id: string; periodStart: string; periodEnd: string }>> {
    const result = await this.reviewRepository.getById(reviewId);
    if (!result.success) return err(result.error);
    if (!result.data) {
      return err(createError("NOT_FOUND", `Review ${reviewId} not found`));
    }
    return ok({
      id: result.data.id,
      periodStart: result.data.periodStart,
      periodEnd: result.data.periodEnd,
    });
  }

  /**
   * Delete review
   */
  async deleteReview(reviewId: string): Promise<Result<void>> {
    return await this.reviewRepository.delete(reviewId);
  }
}

let reviewService: ReviewService;

export function getReviewService(): ReviewService {
  if (!reviewService) {
    reviewService = new ReviewService();
  }
  return reviewService;
}
