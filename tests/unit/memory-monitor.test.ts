import type { IMemoryInfoProvider } from "@/shared/ai/memory-monitor";
import { MemoryMonitor } from "@/shared/ai/memory-monitor";

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

describe("MemoryMonitor.evaluate()", () => {
  test("returns all required MemoryPressure fields", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const pressure = await monitor.evaluate();
    expect(pressure.totalRAM).toBeDefined();
    expect(pressure.usedRAM).toBeDefined();
    expect(pressure.availableRAM).toBeDefined();
    expect(pressure.utilizationPercent).toBeDefined();
    expect(pressure.criticalLevel).toBeDefined();
    expect(pressure.canRunInference).toBeDefined();
    expect(pressure.recommendedMaxContext).toBeDefined();
    expect(pressure.sampledAt).toBeDefined();
  });

  test("utilizationPercent is 50 when half RAM is used", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const pressure = await monitor.evaluate();
    expect(pressure.utilizationPercent).toBe(50);
  });

  test("criticalLevel is false when utilization is below 85%", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const pressure = await monitor.evaluate();
    expect(pressure.criticalLevel).toBe(false);
  });

  test("criticalLevel is true when utilization exceeds 85%", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 3.6));
    const pressure = await monitor.evaluate();
    expect(pressure.utilizationPercent).toBeGreaterThan(85);
    expect(pressure.criticalLevel).toBe(true);
  });

  test("canRunInference is true when there is sufficient free memory", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const pressure = await monitor.evaluate();
    expect(pressure.canRunInference).toBe(true);
  });

  test("canRunInference is false when all RAM is fully used (0 bytes free)", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 4));
    const pressure = await monitor.evaluate();
    expect(pressure.canRunInference).toBe(false);
  });

  test("availableRAM is totalRAM minus usedRAM (clamped to 0)", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const pressure = await monitor.evaluate();
    expect(pressure.availableRAM).toBeGreaterThan(0);
    expect(pressure.availableRAM).toBeLessThan(4 * BYTES_TO_GB);
  });

  test("recommendedMaxContext is capped at configured n_ctx", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(8, 2));
    monitor.configure({ n_ctx: 512, n_batch: 64 });
    const pressure = await monitor.evaluate();
    expect(pressure.recommendedMaxContext).toBeLessThanOrEqual(512);
  });

  test("sampledAt is a recent timestamp", async () => {
    const before = Date.now();
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const pressure = await monitor.evaluate();
    const after = Date.now();
    expect(pressure.sampledAt).toBeGreaterThanOrEqual(before);
    expect(pressure.sampledAt).toBeLessThanOrEqual(after);
  });

  test("falls back to defaults on provider error", async () => {
    const failProvider: IMemoryInfoProvider = {
      getTotalMemory: () => Promise.reject(new Error("hw fail")),
      getUsedMemory: () => Promise.reject(new Error("hw fail")),
    };
    const monitor = new MemoryMonitor(failProvider);
    const pressure = await monitor.evaluate();
    expect(pressure.totalRAM).toBeGreaterThan(0);
  });
});

describe("MemoryMonitor.configure()", () => {
  test("updates runtime config for context calculation", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 1));
    monitor.configure({ n_ctx: 256, n_batch: 32 });
    const pressure = await monitor.evaluate();
    expect(pressure.recommendedMaxContext).toBeLessThanOrEqual(256);
  });

  test("onMemoryWarning callback is invoked when critical", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 3.6));
    const warnings: number[] = [];
    monitor.configure(
      { n_ctx: 1024, n_batch: 64 },
      { onMemoryWarning: () => warnings.push(Date.now()) },
    );
    await monitor.evaluate();
    expect(warnings.length).toBe(1);
  });

  test("onMemoryWarning callback is NOT invoked when not critical", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    const warnings: number[] = [];
    monitor.configure(
      { n_ctx: 1024, n_batch: 64 },
      { onMemoryWarning: () => warnings.push(Date.now()) },
    );
    await monitor.evaluate();
    expect(warnings.length).toBe(0);
  });
});

describe("MemoryMonitor.onAppBackground()", () => {
  test("calls unloadModel when memory is critical on background", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 3.6));
    let unloaded = false;
    monitor.configure(
      { n_ctx: 1024, n_batch: 64 },
      { unloadModel: async () => { unloaded = true; } },
    );
    monitor.onAppBackground();
    await new Promise((r) => setTimeout(r, 20));
    expect(unloaded).toBe(true);
  });

  test("does NOT call unloadModel when memory is healthy", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 2));
    let unloaded = false;
    monitor.configure(
      { n_ctx: 1024, n_batch: 64 },
      { unloadModel: async () => { unloaded = true; } },
    );
    monitor.onAppBackground();
    await new Promise((r) => setTimeout(r, 20));
    expect(unloaded).toBe(false);
  });
});

describe("MemoryMonitor.onMemoryWarning()", () => {
  test("replaces the warning callback", async () => {
    const monitor = new MemoryMonitor(makeMemoryProvider(4, 3.6));
    monitor.configure({ n_ctx: 1024, n_batch: 64 });
    let callCount = 0;
    monitor.onMemoryWarning(() => callCount++);
    await monitor.evaluate();
    expect(callCount).toBe(1);
  });
});
