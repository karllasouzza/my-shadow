import {
  calculateMemoryBudget,
  calculateMemoryBudgetFromPath,
  preflightCheck,
} from "@/shared/ai/model-budget";
import type { IMemoryInfoProvider } from "@/shared/ai/memory-monitor";
import { MemoryMonitor } from "@/shared/ai/memory-monitor";
import { describe, expect, test } from "bun:test";

const BYTES_TO_GB = 1024 ** 3;

function makeMemoryProvider(
  totalGB: number,
  usedGB: number,
): IMemoryInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(totalGB * BYTES_TO_GB),
    getUsedMemory: () => Promise.resolve(usedGB * BYTES_TO_GB),
  };
}

describe("T073: calculateMemoryBudget — model fits in RAM", () => {
  test("4 GB model with 2048 context fits in 8 GB RAM", () => {
    const result = calculateMemoryBudget(4, 2048, "f16", 8);
    expect(result.sufficient).toBe(true);
    expect(result.requiredGB).toBeCloseTo(6.25, 1);
    expect(result.availableGB).toBe(8);
  });

  test("4 GB model with 4096 context, q8_0, fits in 16 GB RAM", () => {
    const result = calculateMemoryBudget(4, 4096, "q8_0", 16);
    expect(result.sufficient).toBe(true);
  });
});

describe("T074: preflightCheck — file not found", () => {
  test("non-existent model path → canLoad=false, reason in pt-BR", async () => {
    const result = await preflightCheck({
      modelPath: "/absolutely/no/model.gguf",
      availableRAM: 16,
    });
    expect(result.canLoad).toBe(false);
    expect(result.integrityStatus).toBe("failed");
    expect(result.reasons.some((r) => r.includes("Modelo não encontrado"))).toBe(true);
  });
});

describe("T075: calculateMemoryBudget — required exceeds available", () => {
  test("4 GB model, 2048 context, f16, 4 GB RAM → insufficient", () => {
    const result = calculateMemoryBudget(4, 2048, "f16", 4);
    expect(result.sufficient).toBe(false);
    expect(result.requiredGB).toBeGreaterThan(result.availableGB);
  });

  test("preflightCheck with 1 GB RAM reflects RAM insufficient in pt-BR reason", async () => {
    const result = await preflightCheck({
      modelPath: "package.json",
      availableRAM: 1,
      contextSize: 2048,
      kvCacheType: "f16",
    });
    expect(result.canLoad).toBe(false);
    expect(result.ramSufficient).toBe(false);
    expect(result.reasons.some((r) => r.includes("Memória insuficiente"))).toBe(true);
  });
});

describe("T076: MemoryMonitor startMonitoring / stopMonitoring", () => {
  test("critical callback fires when RAM > 85% used", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 3.6));
    let callbackFired = false;

    monitor.startMonitoring((pressure) => {
      callbackFired = true;
      expect(pressure.criticalLevel).toBe(true);
    });

    await monitor.evaluate();
    monitor.stopMonitoring();

    expect(callbackFired).toBe(true);
  });

  test("startMonitoring is idempotent (calling twice doesn't double-register)", () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(8, 2));
    expect(() => {
      monitor.startMonitoring();
      monitor.startMonitoring();
      monitor.stopMonitoring();
    }).not.toThrow();
  });
});

describe("T077: calculateMemoryBudgetFromPath integration", () => {
  test("falls back gracefully for missing file", async () => {
    const result = await calculateMemoryBudgetFromPath(
      "/missing/model.gguf",
      1024,
      "q8_0",
      8,
    );
    // Conservative fallback: 4 GB weights, 1024 context
    expect(result.breakdown.weightsGB).toBeCloseTo(4, 0);
    expect(result.sufficient).toBe(true); // 8 GB available, fallback ≈ 5.6 GB needed
  });
});
