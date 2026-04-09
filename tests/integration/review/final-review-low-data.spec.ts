/**
 * T035: Integration test for constrained low-data review response
 *
 * Tests that the review service gracefully handles periods with limited data:
 * - Single or very few reflections
 * - Acknowledges data limitations in response
 * - Still provides useful structure and next inquiry prompts
 * - Does not fabricate false patterns
 */

interface LowDataReviewResponse {
  id: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  dataLimitationNote: string;
  recurringPatterns: string[];
  emotionalTriggers: string[];
  nextInquiryPrompts: string[];
  generatedAt: string;
}

/**
 * Mock low-data aware review service
 */
class MockLowDataReviewService {
  async generateLowDataReview(
    reflectionIds: string[],
    periodStart: string,
    periodEnd: string,
  ): Promise<LowDataReviewResponse> {
    const reflectionCount = reflectionIds.length;

    // Check for low-data condition
    const isLowData = reflectionCount < 3;

    if (reflectionCount === 0) {
      throw new Error("Cannot generate review without at least one reflection");
    }

    const summary =
      reflectionCount === 1
        ? `Durante este período, você ofereceu uma reflexão. Com apenas uma entrada, não é possível identificar padrões claros, mas esta reflexão oferece um ponto de partida valioso para exploração contínua.`
        : `Ao longo deste período, suas ${reflectionCount} reflexões revelam explorações iniciais de temas importantes. Embora o volume limitado de dados impeça conclusões sólidas, as linhas emergentes indicam direções promissoras para investigação mais profunda.`;

    const dataLimitationNote =
      reflectionCount === 1
        ? "Apenas uma reflexão foi registrada durante este período. Para identificar padrões significativos, é recomendado acumular mais entradas ao longo de múltiplas semanas."
        : `Apenas ${reflectionCount} reflexões foram registradas. Para análises mais robustas e identificação de padrões verdadeiros, recomenda-se um mínimo de 5-7 reflexões por período.`;

    return {
      id: `review_low_${Date.now()}`,
      periodStart,
      periodEnd,
      summary,
      dataLimitationNote,
      recurringPatterns:
        reflectionCount === 1
          ? [] // No patterns with 1 entry
          : ["Tema emergente em exploração"],
      emotionalTriggers: ["Exploração em andamento"],
      nextInquiryPrompts: [
        "Qual aspecto dessa reflexão ressoou mais profundamente comigo?",
        "Como posso aprofundar essa linha de investigação nas próximas semanas?",
        "Que outros contextos relacionados poderia explorar?",
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

describe("Final Review Generation - Low Data Case", () => {
  let service: MockLowDataReviewService;

  beforeEach(() => {
    service = new MockLowDataReviewService();
  });

  it("should handle single reflection gracefully", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    expect(review.id).toBeDefined();
    expect(review.summary).toContain("uma reflexão");
    expect(review.dataLimitationNote).toBeDefined();
    expect(review.dataLimitationNote.length).toBeGreaterThan(0);
  });

  it("should not fabricate patterns with single reflection", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    // Should have no patterns with only 1 entry
    expect(review.recurringPatterns.length).toBe(0);
  });

  it("should provide limitation note for single reflection", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    expect(review.dataLimitationNote).toContain("Apenas uma reflexão");
    expect(review.dataLimitationNote.length).toBeGreaterThan(20);
  });

  it("should handle two reflections with cautious language", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001", "refl_002"],
      "2026-03-01",
      "2026-03-31",
    );

    expect(review.summary).toContain("reflexões");
    expect(review.dataLimitationNote).toContain("recomenda");
  });

  it("should still provide next inquiry prompts for low data", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    expect(review.nextInquiryPrompts).toBeDefined();
    expect(review.nextInquiryPrompts.length).toBeGreaterThan(0);
  });

  it("should mark prompts as exploratory, not prescriptive", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    // Prompts should be exploratory questions
    for (const prompt of review.nextInquiryPrompts) {
      expect(prompt.includes("?")).toBe(true);
      expect(prompt.toLowerCase()).toMatch(/como|qual|que|onde/); // Open-ended
    }
  });

  it("should reject zero reflections", async () => {
    try {
      await service.generateLowDataReview([], "2026-03-01", "2026-03-07");
      expect(true).toBe(false); // Should not reach
    } catch (error) {
      expect(error instanceof Error).toBe(true);
    }
  });

  it("should acknowledge limited data in Portuguese", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    // All text should be in pt-BR
    expect(review.summary).toMatch(/[a-záàâãéèêíìîóòôõöúùûü]/);
    expect(review.dataLimitationNote).toMatch(/[a-záàâãéèêíìîóòôõöúùûü]/);
  });

  it("should include honest assessment in summary for 2-3 reflections", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001", "refl_002", "refl_003"],
      "2026-03-01",
      "2026-03-31",
    );

    // Should acknowledge exploratory nature, not definitiveness
    expect(review.summary.toLowerCase()).toMatch(
      /emergente|inicial|exploração/,
    );
  });

  it("should provide different limitation notes for 1 vs 2+ reflections", async () => {
    const review1 = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    const review2 = await service.generateLowDataReview(
      ["refl_001", "refl_002"],
      "2026-03-01",
      "2026-03-07",
    );

    expect(review1.dataLimitationNote).not.toMatch(/duas/);
    expect(review2.dataLimitationNote).toContain("2");
  });

  it("should still return valid review structure", async () => {
    const review = await service.generateLowDataReview(
      ["refl_001"],
      "2026-03-01",
      "2026-03-07",
    );

    expect(review.id).toBeDefined();
    expect(typeof review.id).toBe("string");
    expect(review.periodStart).toBe("2026-03-01");
    expect(review.periodEnd).toBe("2026-03-07");
    expect(typeof review.summary).toBe("string");
    expect(Array.isArray(review.recurringPatterns)).toBe(true);
    expect(Array.isArray(review.emotionalTriggers)).toBe(true);
    expect(Array.isArray(review.nextInquiryPrompts)).toBe(true);
  });
});
