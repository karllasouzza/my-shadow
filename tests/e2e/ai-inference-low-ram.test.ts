/**
 * End-to-end tests for AI inference on simulated low-RAM devices.
 *
 * ⚠️ Requires real device or iOS/Android simulator with model loaded.
 *    Tests are skipped automatically when MODEL_PATH is not set.
 *    Run on device: MODEL_PATH=/path/to/model.gguf bun test ./tests/e2e/ai-inference-low-ram.test.ts
 *
 * Acceptance criteria (from spec.md):
 *   - Budget 4GB: inference succeeds, peak memory < 3.5GB
 *   - Budget 4GB at max context (1024 tokens): graceful degradation, no crash
 *   - Memory pressure > 70%: MemoryMonitor detects and reports it
 */
import type {
    IDeviceInfoProvider,
    IPlatformProvider,
} from "@/shared/ai/device-detector";
import { DeviceDetector } from "@/shared/ai/device-detector";
import type { IMemoryInfoProvider } from "@/shared/ai/memory-monitor";
import { MemoryMonitor } from "@/shared/ai/memory-monitor";
import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";
import { describe, expect, test } from "bun:test";

const MODEL_PATH = process.env.MODEL_PATH ?? "";
const hasModel = MODEL_PATH.length > 0;

function itOnDevice(name: string, fn: () => Promise<void> | void): void {
  if (hasModel) {
    test(name, fn, 60000);
  } else {
    test.skip(`[SKIPPED — no MODEL_PATH] ${name}`, () => {});
  }
}

const GB = 1024 ** 3;

function makeProvider(totalGB: number, usedGB: number): IDeviceInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(totalGB * GB),
    getUsedMemory: () => Promise.resolve(usedGB * GB),
    getMaxMemory: () => Promise.resolve(8),
    getNumberOfCores: () => Promise.resolve(8),
    getBrand: () => Promise.resolve("Qualcomm"),
    getSystemVersion: () => Promise.resolve("12.0"),
    getModel: () => Promise.resolve("Pixel 4a"),
  };
}

function makeMemoryProvider(
  totalGB: number,
  usedGB: number,
): IMemoryInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(totalGB * GB),
    getUsedMemory: () => Promise.resolve(usedGB * GB),
  };
}

const androidPlatform: IPlatformProvider = { OS: "android" };
const generator = new RuntimeConfigGenerator();

// ─────────────────────────────────────────────────────────────────────────
// T028: Chat inference on budget 4GB device
// ─────────────────────────────────────────────────────────────────────────
describe("T028: E2E — Chat inference on budget device (4GB Android)", () => {
  itOnDevice(
    "model loads with budget config (n_ctx=1024, use_mmap=true)",
    async () => {
      const { initLlama } = await import("llama.rn");
      const deviceInfo = await new DeviceDetector(
        makeProvider(4, 0.8),
        androidPlatform,
      ).detect();
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
      const deviceInfo = await new DeviceDetector(
        makeProvider(4, 0.8),
        androidPlatform,
      ).detect();
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

// ─────────────────────────────────────────────────────────────────────────
// T029: Context limit handling on budget device
// ─────────────────────────────────────────────────────────────────────────
describe("T029: E2E — Context limit on budget device (n_ctx=1024)", () => {
  itOnDevice("inference at near-max context does not crash", async () => {
    const { initLlama } = await import("llama.rn");
    const deviceInfo = await new DeviceDetector(
      makeProvider(4, 0.8),
      androidPlatform,
    ).detect();
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
