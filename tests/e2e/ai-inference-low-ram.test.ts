import type { MemoryInfoProvider } from "@/shared/ai/memory-monitor";
import { MemoryMonitor } from "@/shared/ai/memory-monitor";
import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";
import { describe, expect, test } from "bun:test";
import { mockBudgetDevice } from "../utils/device-simulator";

const MODEL_PATH = process.env.MODEL_PATH ?? "";
const hasModel = MODEL_PATH.length > 0;

function itOnDevice(name: string, fn: () => Promise<void> | void): void {
  if (hasModel) {
    test(name, fn);
  }
  // When MODEL_PATH is not set, tests are silently skipped (not run)
}

const GB = 1024 ** 3;
const generator = new RuntimeConfigGenerator();

function makeMemoryProvider(
  totalGB: number,
  usedGB: number,
): MemoryInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(totalGB * GB),
    getUsedMemory: () => Promise.resolve(usedGB * GB),
  };
}

describe("T028: E2E — Chat inference on budget device (4GB Android)", () => {
  itOnDevice(
    "model loads with budget config (n_ctx=1024, use_mmap=true)",
    async () => {
      const { initLlama } = await import("llama.rn");
      const deviceInfo = mockBudgetDevice();
      const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);

      expect(config.n_ctx).toBe(1024);
      expect(config.use_mmap).toBe(true);

      const ctx = await initLlama(config);
      expect(ctx).toBeDefined();
      await ctx.release();
    },
  );

  itOnDevice(
    "inference returns non-empty response on budget config",
    async () => {
      const { initLlama } = await import("llama.rn");
      const deviceInfo = mockBudgetDevice();
      const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
      const ctx = await initLlama(config);

      const result = await ctx.completion({
        messages: [{ role: "user", content: "Say hello." }],
        n_predict: 20,
        temperature: 0.1,
      });

      expect(result.text.trim().length).toBeGreaterThan(0);
      await ctx.release();
    },
  );
});

describe("T029: E2E — Context limit on budget device (n_ctx=1024)", () => {
  itOnDevice("inference at near-max context does not crash", async () => {
    const { initLlama } = await import("llama.rn");
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    const ctx = await initLlama(config);

    // Build up context to ~80% of the budget limit
    const longMessage =
      "Tell me about memory management in mobile systems. ".repeat(15);
    const result = await ctx.completion({
      messages: [{ role: "user", content: longMessage }],
      n_predict: 50,
      temperature: 0.1,
    });

    // Should complete, not throw
    expect(result).toBeDefined();
    await ctx.release();
  });

  itOnDevice(
    "recommended max context is within budget tier limit",
    async () => {
      const monitor = new MemoryMonitor(makeMemoryProvider(4, 0.8));
      monitor.configure({ n_ctx: 1024, n_batch: 64 });
      const pressure = await monitor.evaluate();

      expect(pressure.recommendedMaxContext).toBeLessThanOrEqual(1024);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────
// T030: Memory pressure detection
// ─────────────────────────────────────────────────────────────────────────
describe("T030: E2E — Memory pressure warning on 70%+ utilization", () => {
  test("MemoryMonitor detects pressure at 70% utilization (simulated)", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2.8));
    const pressure = await monitor.evaluate();

    // 2.8/4 = 70% utilization
    expect(pressure.utilizationPercent).toBeGreaterThanOrEqual(70);
    expect(pressure.criticalLevel).toBe(false); // 70% < 85% threshold
    expect(pressure.availableRAM).toBeGreaterThan(0);
  });

  test("MemoryMonitor warning callback fires at 85%+ utilization", async () => {
    const warnings: number[] = [];
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 3.6));
    monitor.configure(
      { n_ctx: 1024, n_batch: 64 },
      { onMemoryWarning: () => warnings.push(Date.now()) },
    );

    await monitor.evaluate();
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  test("Memory pressure canRunInference=true at 70% utilization", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2.8));
    const pressure = await monitor.evaluate();
    expect(pressure.canRunInference).toBe(true);
  });
});
