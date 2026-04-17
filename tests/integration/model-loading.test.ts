import { describe, test, expect } from "bun:test";
import {
  calculateMemoryBudget,
  verifyIntegrity,
  preflightCheck,
} from "@/shared/ai/model-budget";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("Model Loading Integration", () => {
  test("T099 preflight + integridade bem-sucedidos para arquivo válido", async () => {
    const dir = await mkdtemp(join(tmpdir(), "integration-test-"));
    const testFile = join(dir, "small.gguf");
    await writeFile(testFile, Buffer.alloc(1024 * 1024)); // 1 MB dummy model

    const integrityResult = await verifyIntegrity(testFile);
    const realHash = integrityResult.calculatedHash;

    const result = await preflightCheck({
      modelPath: testFile,
      availableRAM: 16,
      contextSize: 512,
      kvCacheType: "q8_0",
      expectedHash: realHash,
    });

    expect(result.integrityOk).toBe(true);
    expect(result.integrityStatus).toBe("verified");
    expect(result.ramSufficient).toBe(true);
    expect(result.canLoad).toBe(true);

    await rm(dir, { recursive: true });
  });

  test("T100 preflight rejeita modelo com falha de integridade", async () => {
    const dir = await mkdtemp(join(tmpdir(), "integration-test-"));
    const testFile = join(dir, "corrupt.gguf");
    await writeFile(testFile, Buffer.alloc(1024)); // 1 KB dummy

    const result = await preflightCheck({
      modelPath: testFile,
      availableRAM: 16,
      contextSize: 512,
      kvCacheType: "q8_0",
      expectedHash: "b".repeat(64),
    });

    expect(result.integrityOk).toBe(false);
    expect(result.integrityStatus).toBe("failed");
    expect(result.canLoad).toBe(false);
    expect(result.reasons.some((r) => r.includes("integridade"))).toBe(true);

    await rm(dir, { recursive: true });
  });

  test("T098 pipeline completo: orçamento de memória → preflight", () => {
    // Simula modelo de 4 GB em dispositivo com 8 GB disponíveis
    const budget = calculateMemoryBudget(4, 2048, "q8_0", 8);

    expect(budget.sufficient).toBe(true);
    expect(budget.requiredGB).toBeLessThan(8);
  });

  test("T101 preflight para arquivo de modelo inexistente", async () => {
    const result = await preflightCheck({
      modelPath: "/does/not/exist.gguf",
      availableRAM: 8,
    });

    expect(result.canLoad).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
