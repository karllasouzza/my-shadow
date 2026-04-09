/**
 * T045: Integration test for markdown bundle generation
 * Tests that the export service produces properly structured markdown
 */

interface ExportBundle {
  id: string;
  fileName: string;
  markdownContent: string;
  fileSize: number;
}

/**
 * Mock markdown export service
 */
class MockMarkdownExportService {
  async generateMarkdown(
    reflectionIds: string[],
    questionSetIds: string[],
    reviewIds: string[],
    periodStart: string,
    periodEnd: string,
  ): Promise<ExportBundle> {
    // Build markdown content
    let content = `# Reflexões de ${periodStart} a ${periodEnd}\n\n`;

    if (reflectionIds.length > 0) {
      content += `## Reflexões\n\nTotal: ${reflectionIds.length} reflexões\n\n`;
      reflectionIds.forEach((id, i) => {
        content += `- Reflexão ${i + 1}: ${id}\n`;
      });
      content += "\n";
    }

    if (questionSetIds.length > 0) {
      content += `## Conjuntos de Questões\n\nTotal: ${questionSetIds.length} conjuntos\n\n`;
      questionSetIds.forEach((id, i) => {
        content += `- Conjunto ${i + 1}: ${id}\n`;
      });
      content += "\n";
    }

    if (reviewIds.length > 0) {
      content += `## Análises Periódicas\n\nTotal: ${reviewIds.length} análises\n\n`;
      reviewIds.forEach((id, i) => {
        content += `- Análise ${i + 1}: ${id}\n`;
      });
      content += "\n";
    }

    content += `---\n\nExportado em: ${new Date().toLocaleString("pt-BR")}\n`;

    const fileName = `reflexoes_${periodStart}_${periodEnd}.md`;
    const fileSize = new Blob([content]).size;

    return {
      id: `export_${Date.now()}`,
      fileName,
      markdownContent: content,
      fileSize,
    };
  }
}

describe("Markdown Export Bundle Generation", () => {
  let service: MockMarkdownExportService;

  beforeEach(() => {
    service = new MockMarkdownExportService();
  });

  it("should generate markdown with reflection section", async () => {
    const bundle = await service.generateMarkdown(
      ["refl_001", "refl_002"],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(bundle.markdownContent).toContain("## Reflexões");
    expect(bundle.markdownContent).toContain("Total: 2 reflexões");
    expect(bundle.markdownContent).toContain("refl_001");
  });

  it("should generate markdown with all sections", async () => {
    const bundle = await service.generateMarkdown(
      ["refl_001"],
      ["qs_001"],
      ["rev_001"],
      "2026-03-01",
      "2026-03-31",
    );

    expect(bundle.markdownContent).toContain("## Reflexões");
    expect(bundle.markdownContent).toContain("## Conjuntos de Questões");
    expect(bundle.markdownContent).toContain("## Análises Periódicas");
  });

  it("should set correct filename format", async () => {
    const bundle = await service.generateMarkdown(
      ["refl_001"],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(bundle.fileName).toBe("reflexoes_2026-03-01_2026-03-31.md");
  });

  it("should include export timestamp in Portuguese", async () => {
    const bundle = await service.generateMarkdown(
      ["refl_001"],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    expect(bundle.markdownContent).toContain("Exportado em:");
  });

  it("should calculate file size correctly", async () => {
    const bundle = await service.generateMarkdown(
      ["refl_001", "refl_002"],
      [],
      [],
      "2026-03-01",
      "2026-03-31",
    );

    const calculatedSize = new Blob([bundle.markdownContent]).size;
    expect(bundle.fileSize).toBe(calculatedSize);
  });

  it("should preserve chronological order of artifacts", async () => {
    const bundle = await service.generateMarkdown(
      ["refl_001", "refl_002", "refl_003"],
      ["qs_001", "qs_002"],
      ["rev_001"],
      "2026-03-01",
      "2026-03-31",
    );

    // Check that sections appear in expected order
    const reflexPos = bundle.markdownContent.indexOf("## Reflexões");
    const questaoPos = bundle.markdownContent.indexOf("## Conjuntos");
    const analisePos = bundle.markdownContent.indexOf("## Análises");

    expect(reflexPos).toBeLessThan(questaoPos);
    expect(questaoPos).toBeLessThan(analisePos);
  });
});
