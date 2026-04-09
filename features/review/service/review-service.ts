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
import { getModelRepository } from "../../onboarding/repository/model-repository";
import { getReflectionRepository } from "../../reflection/repository/reflection-repository";
import { FinalReview } from "../model/final-review";
import { getReviewRepository } from "../repository/review-repository";

/** T053: Performance budget thresholds */
const PERF_BUDGET = {
  loadReflectionsMs: 200,
  aiCompletionMs: 30_000,
  totalMs: 35_000,
};

interface ParsedReviewOutput {
  summary: string;
  patterns: string[];
  triggers: string[];
  prompts: string[];
}

interface GenerationTimings {
  loadReflectionsMs: number;
  aiCompletionMs: number;
  totalMs: number;
  withinBudget: boolean;
  violations: string[];
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
    const totalStart = performance.now();
    const timings: GenerationTimings = {
      loadReflectionsMs: 0,
      aiCompletionMs: 0,
      totalMs: 0,
      withinBudget: true,
      violations: [],
    };

    try {
      if (reflectionIds.length === 0) {
        return err(
          createError(
            "VALIDATION_ERROR",
            "Nenhuma reflexao encontrada no periodo selecionado para gerar revisao.",
          ),
        );
      }

      const loadStart = performance.now();
      const reflectionContents =
        await this.loadReflectionContents(reflectionIds);
      timings.loadReflectionsMs = Math.round(performance.now() - loadStart);

      if (reflectionContents.length === 0) {
        return err(
          createError(
            "NOT_FOUND",
            "Nenhum conteudo de reflexao disponivel para o periodo selecionado",
            { periodStart, periodEnd },
          ),
        );
      }

      const runtime = getLocalAIRuntime();
      const runtimeInit = await runtime.initialize();

      let parsedOutput: ParsedReviewOutput | null = null;
      if (runtimeInit.success) {
        await runtime.waitReady();

        // T022: Load model with valid path from model repository if available
        const modelRepo = getModelRepository();
        const activeModel = modelRepo.getActiveModel();
        const modelPath = activeModel?.filePath || activeModel?.customFolderUri;

        if (modelPath) {
          await runtime.loadModel(
            activeModel?.id || "qwen2.5-0.5b-quantized",
            modelPath,
          );
        }
        // If no modelPath available, ensureDefaultModelLoaded() will return proper error

        const aiStart = performance.now();
        const completionResult = await runtime.generateCompletion([
          {
            role: "system",
            content:
              "Voce e um sintetizador de sombras junguiano em portugues do Brasil. Sua tarefa e integrar os conteudos inconscientes emergidos nas reflexoes, identificando padroes recorrentes, projecoes da sombra, compensacoes psiquicas e sinais de individuacao. Mantenha tom acolhedor, nao-diretivo e respeitoso. Nao patologize, nao diagnose, nao imponha interpretacoes. Honre a autonomia do sujeito. Responda exclusivamente em pt-BR.",
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
        timings.aiCompletionMs = Math.round(performance.now() - aiStart);

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

      timings.totalMs = Math.round(performance.now() - totalStart);
      this.checkPerformanceBudget(timings);

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
          `Falha ao gerar revisao: ${error instanceof Error ? error.message : String(error)}`,
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
      "Tarefa: sintetizar padroes recorrentes, gatilhos emocionais e proximas investigacoes a partir do trabalho de sombra junguiano.",
      "Regras:",
      "- Responder somente em pt-BR.",
      "- Nao inventar fatos alem das reflexoes fornecidas.",
      "- Manter tom introspectivo, acolhedor e nao-diretivo.",
      "- Identificar padroes recorrentes sem patologizar.",
      "- Respeitar a autonomia e o ritmo de individuacao do sujeito.",
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
   * T053: Check performance budget and log violations.
   * Non-blocking: does not throw, only records violations.
   */
  private checkPerformanceBudget(timings: GenerationTimings): void {
    const violations: string[] = [];

    if (timings.loadReflectionsMs > PERF_BUDGET.loadReflectionsMs) {
      violations.push(
        `loadReflections ${timings.loadReflectionsMs}ms > ${PERF_BUDGET.loadReflectionsMs}ms`,
      );
    }
    if (timings.aiCompletionMs > PERF_BUDGET.aiCompletionMs) {
      violations.push(
        `aiCompletion ${timings.aiCompletionMs}ms > ${PERF_BUDGET.aiCompletionMs}ms`,
      );
    }
    if (timings.totalMs > PERF_BUDGET.totalMs) {
      violations.push(`total ${timings.totalMs}ms > ${PERF_BUDGET.totalMs}ms`);
    }

    timings.violations = violations;
    timings.withinBudget = violations.length === 0;

    if (!timings.withinBudget) {
      console.warn(
        "[ReviewService] Performance budget exceeded:",
        violations.join("; "),
        JSON.stringify(timings),
      );
    }
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
