import {
  calculateMemoryBudget,
  calculateMemoryBudgetFromPath,
  preflightCheck,
  verifyIntegrity,
} from "@/shared/ai/model-budget";
import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const BYTES_TO_GB = 1024 ** 3;

describe("calculateMemoryBudget()", () => {
  test("T066: returns all required fields", () => {
    const result = calculateMemoryBudget(4, 2048, "f16", 8);
    expect(result.requiredGB).toBeDefined();
    expect(result.availableGB).toBe(8);
    expect(typeof result.sufficient).toBe("boolean");
    expect(result.breakdown.weightsGB).toBe(4);
    expect(result.breakdown.kvCacheGB).toBeDefined();
    expect(result.breakdown.workingMemoryGB).toBeDefined();
    expect(result.breakdown.overheadGB).toBe(0.5);
  });

  test("T067: formula accuracy for 7B model, 2048 context, f16", () => {
    // KV Cache = 2 × 32 × 2048 × 128 × 32 × 2 bytes = 1 073 741 824 bytes ≈ 1 GB
    // working  = (4 + 1) × 0.15 = 0.75 GB
    // total    = 4 + 1 + 0.75 + 0.5 = 6.25 GB
    const result = calculateMemoryBudget(4, 2048, "f16", 8);
    expect(result.breakdown.kvCacheGB).toBeCloseTo(1.0, 1);
    expect(result.breakdown.workingMemoryGB).toBeCloseTo(0.75, 2);
    expect(result.requiredGB).toBeCloseTo(6.25, 1);
    expect(result.sufficient).toBe(true);
  });

  test("T067b: q8_0 halves the KV cache size compared to f16", () => {
    const f16 = calculateMemoryBudget(4, 2048, "f16", 8);
    const q8 = calculateMemoryBudget(4, 2048, "q8_0", 8);
    expect(q8.breakdown.kvCacheGB).toBeCloseTo(f16.breakdown.kvCacheGB / 2, 2);
  });

  test("T067c: q4_0 is 25% the KV cache size of f16", () => {
    const f16 = calculateMemoryBudget(4, 2048, "f16", 8);
    const q4 = calculateMemoryBudget(4, 2048, "q4_0", 8);
    expect(q4.breakdown.kvCacheGB).toBeCloseTo(f16.breakdown.kvCacheGB / 4, 2);
  });

  test("sufficient is false when required exceeds available", () => {
    const result = calculateMemoryBudget(4, 2048, "f16", 4);
    expect(result.sufficient).toBe(false);
    expect(result.requiredGB).toBeGreaterThan(4);
  });

  test("T116 rejects model when available RAM < 1GB", () => {
    const budget = calculateMemoryBudget(3, 512, "q4_0", 0.8);
    expect(budget.sufficient).toBe(false);
    expect(budget.availableGB).toBe(0.8);
  });

  test("T117 handles zero available RAM gracefully", () => {
    const budget = calculateMemoryBudget(4, 2048, "f16", 0);
    expect(budget.sufficient).toBe(false);
    expect(budget.availableGB).toBe(0);
    expect(budget.requiredGB).toBeGreaterThan(0);
  });

  test("T118 model too large for device total RAM", () => {
    const budget = calculateMemoryBudget(70, 2048, "f16", 8); // 70B model
    expect(budget.sufficient).toBe(false);
    expect(budget.requiredGB).toBeGreaterThan(70);
  });
});

describe("calculateMemoryBudgetFromPath()", () => {
  test("T068: falls back to conservative estimate for non-existent path", async () => {
    const result = await calculateMemoryBudgetFromPath(
      "/no/such/model.gguf",
      2048,
      "f16",
      8,
    );
    // Conservative: 4 GB model, 1024 context, f16
    expect(result.breakdown.weightsGB).toBeCloseTo(4, 1);
    expect(result.requiredGB).toBeGreaterThan(0);
  });

  test("reads actual file size from disk", async () => {
    // package.json is tiny — requiredGB reflects its actual byte count
    const result = await calculateMemoryBudgetFromPath(
      "package.json",
      512,
      "q8_0",
      8,
    );
    expect(result.breakdown.weightsGB).toBeGreaterThanOrEqual(0);
    expect(result.sufficient).toBe(true); // package.json is negligible
  });
});

describe("preflightCheck()", () => {
  test("T069: non-existent file → canLoad=false with pt-BR reason", async () => {
    const result = await preflightCheck({
      modelPath: "/no/such/model.gguf",
      availableRAM: 8,
    });
    expect(result.canLoad).toBe(false);
    expect(result.ramSufficient).toBe(false);
    expect(result.integrityOk).toBe(false);
    expect(result.integrityStatus).toBe("failed");
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain("Modelo não encontrado");
  });

  test("T069b: file exists but RAM insufficient → canLoad=false with pt-BR reason", async () => {
    // package.json as stand-in model; 1 GB is far below required for 1024-ctx
    const result = await preflightCheck({
      modelPath: "package.json",
      availableRAM: 1,
      contextSize: 2048,
      kvCacheType: "f16",
    });
    expect(result.canLoad).toBe(false);
    expect(result.ramSufficient).toBe(false);
    expect(result.reasons.some((r) => r.includes("Memória insuficiente"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("GB necessário"))).toBe(true);
  });

  test("file exists with sufficient RAM → canLoad=true", async () => {
    const result = await preflightCheck({
      modelPath: "package.json",
      availableRAM: 16,
      contextSize: 512,
      kvCacheType: "q4_0",
    });
    expect(result.canLoad).toBe(true);
    expect(result.ramSufficient).toBe(true);
    expect(result.integrityStatus).toBe("unverified");
    expect(result.reasons).toHaveLength(0);
  });

  test("hash mismatch → canLoad=false, integrityStatus=failed", async () => {
    const result = await preflightCheck({
      modelPath: "package.json",
      availableRAM: 16,
      expectedHash: "0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(result.canLoad).toBe(false);
    expect(result.integrityStatus).toBe("failed");
    expect(result.reasons.some((r) => r.includes("integridade"))).toBe(true);
  });
});

describe("verifyIntegrity", () => {
  test("T094 calcula hash SHA256 para arquivo existente", async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-test-"));
    const testFile = join(dir, "model.gguf");
    await writeFile(testFile, "dummy model content for testing");

    const result = await verifyIntegrity(testFile);

    expect(typeof result.calculatedHash).toBe("string");
    expect(result.calculatedHash).toHaveLength(64); // SHA256 hex = 64 chars
    expect(result.matches).toBe(true); // no expectedHash → always true
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.filePath).toBe(testFile);

    await rm(dir, { recursive: true });
  });

  test("T095 detecta divergência de hash corretamente", async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-test-"));
    const testFile = join(dir, "model.gguf");
    await writeFile(testFile, "dummy model content for testing");

    const wrongHash = "a".repeat(64);
    const result = await verifyIntegrity(testFile, wrongHash);

    expect(result.matches).toBe(false);
    expect(result.expectedHash).toBe(wrongHash);

    await rm(dir, { recursive: true });
  });

  test("T095b verifica hash correto com sucesso", async () => {
    const dir = await mkdtemp(join(tmpdir(), "model-test-"));
    const testFile = join(dir, "model.gguf");
    await writeFile(testFile, "dummy model content for testing");

    const firstResult = await verifyIntegrity(testFile);
    const correctHash = firstResult.calculatedHash;

    const result = await verifyIntegrity(testFile, correctHash);

    expect(result.matches).toBe(true);

    await rm(dir, { recursive: true });
  });

  test("T096 rejeita arquivo inexistente com erro", async () => {
    await expect(
      verifyIntegrity("/non/existent/model.gguf"),
    ).rejects.toThrow();
  });
});
