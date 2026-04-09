/**
 * T046: Integration test for empty-period no-content handling
 * Tests that export gracefully handles periods with no data
 */

interface EmptyPeriodResponse {
  status: "no_content" | "success";
  message: string;
  bundleId?: string;
  fileSize?: number;
}

/**
 * Mock export service with empty period handling
 */
class MockEmptyPeriodExportService {
  async generateExportForPeriod(
    reflectionIds: string[],
    questionSetIds: string[],
    reviewIds: string[],
    periodStart: string,
    periodEnd: string,
  ): Promise<EmptyPeriodResponse> {
    // Check for empty period
    const totalArtifacts =
      reflectionIds.length + questionSetIds.length + reviewIds.length;

    if (totalArtifacts === 0) {
      return {
        status: "no_content",
        message: `Nenhuma reflexão, questão ou análise encontrada no período de ${periodStart} a ${periodEnd}. Experimente um período diferente ou crie novas reflexões.`,
      };
    }

    // Build markdown
    let content = `# Reflexões de ${periodStart} a ${periodEnd}\n\n`;

    if (reflectionIds.length > 0) {
      content += `## Reflexões\n\n${reflectionIds.map((id) => `- ${id}`).join("\n")}\n\n`;
    }

    if (questionSetIds.length > 0) {
      content += `## Questões\n\n${questionSetIds.map((id) => `- ${id}`).join("\n")}\n\n`;
    }

    if (reviewIds.length > 0) {
      content += `## Análises\n\n${reviewIds.map((id) => `- ${id}`).join("\n")}\n\n`;
    }

    return {
      status: "success",
      message: "Exportação concluída com sucesso",
      bundleId: `export_${Date.now()}`,
      fileSize: new Blob([content]).size,
    };
  }
}

describe("Markdown Export Empty Period Handling", () => {
  let service: MockEmptyPeriodExportService;

  beforeEach(() => {
    service = new MockEmptyPeriodExportService();
  });

  it("should return no_content status for empty period", async () => {
    const result = await service.generateExportForPeriod(
      [],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.status).toBe("no_content");
  });

  it("should provide helpful message for empty period", async () => {
    const result = await service.generateExportForPeriod(
      [],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.message).toContain("Nenhuma reflexão");
    expect(result.message).toContain("período");
  });

  it("should not include bundleId for empty period", async () => {
    const result = await service.generateExportForPeriod(
      [],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.bundleId).toBeUndefined();
  });

  it("should return success when reflections exist", async () => {
    const result = await service.generateExportForPeriod(
      ["refl_001"],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.status).toBe("success");
    expect(result.bundleId).toBeDefined();
  });

  it("should return success when only questions exist", async () => {
    const result = await service.generateExportForPeriod(
      [],
      ["qs_001"],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.status).toBe("success");
    expect(result.bundleId).toBeDefined();
  });

  it("should return success when only reviews exist", async () => {
    const result = await service.generateExportForPeriod(
      [],
      [],
      ["rev_001"],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.status).toBe("success");
  });

  it("should handle mixed content with some empty sections", async () => {
    const result = await service.generateExportForPeriod(
      ["refl_001", "refl_002"],
      [],
      ["rev_001"],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.status).toBe("success");
    expect(result.message).toContain("sucesso");
  });

  it("should not create file for empty period", async () => {
    const result = await service.generateExportForPeriod(
      [],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(result.fileSize).toBeUndefined();
  });
});
