import { buildRuntimeConfig } from "@/shared/device/config-builder";
import { detectCapabilities, DeviceDetector } from "@/shared/device/detector";
import { getTierByRAM, getTierConfig } from "@/shared/device/hardware-database";
import { DetectionDeps, SystemState } from "@/shared/device/types";
import type { IDeviceInfoProvider, IPlatformProvider } from "@/shared/device/adapters";
import { describe, expect, test } from "bun:test";

const FOUR_GB = 4 * 1024 * 1024 * 1024;
const TWO_GB = 2 * 1024 * 1024 * 1024;
const EIGHT_GB = 8 * 1024 * 1024 * 1024;

function makeState(overrides?: Partial<SystemState>): SystemState {
  return {
    totalRAMBytes: FOUR_GB,
    usedRAMBytes: TWO_GB,
    cpuCores: 8,
    brand: "Qualcomm",
    model: "Pixel 4a",
    osVersion: "12.0",
    ...overrides,
  };
}

function makeDeps(
  state: SystemState,
  platform: "ios" | "android" = "android",
): DetectionDeps {
  return {
    getSystemState: () => Promise.resolve(state),
    platform,
  };
}

describe("detectCapabilities", () => {
  test("returns DeviceInfo with all required fields", async () => {
    const info = await detectCapabilities(makeDeps(makeState()));

    expect(typeof info.totalRAM).toBe("number");
    expect(typeof info.availableRAM).toBe("number");
    expect(typeof info.cpuCores).toBe("number");
    expect(typeof info.platform).toBe("string");
    expect(typeof info.detectedAt).toBe("number");
  });

  test("totalRAM is converted from bytes to gigabytes", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ totalRAMBytes: FOUR_GB })),
    );
    expect(info.totalRAM).toBe(4);
  });

  test("availableRAM subtracts used memory and OS overhead", async () => {
    const info = await detectCapabilities(
      makeDeps(
        makeState({
          totalRAMBytes: FOUR_GB,
          usedRAMBytes: TWO_GB,
        }),
      ),
    );
    expect(info.availableRAM).toBeGreaterThan(0);
    expect(info.availableRAM).toBeLessThan(4);
  });

  test("cpuCores is capped at 16", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ cpuCores: 32 })),
    );
    expect(info.cpuCores).toBe(16);
  });

  test("platform is android when deps says android", async () => {
    const info = await detectCapabilities(makeDeps(makeState()));
    expect(info.platform).toBe("android");
  });

  test("platform is ios when deps says ios", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ totalRAMBytes: EIGHT_GB }), "ios"),
    );
    expect(info.platform).toBe("ios");
  });

  test("detectedAt is a recent timestamp", async () => {
    const before = Date.now();
    const info = await detectCapabilities(makeDeps(makeState()));
    const after = Date.now();

    expect(info.detectedAt).toBeGreaterThanOrEqual(before);
    expect(info.detectedAt).toBeLessThanOrEqual(after);
  });

  test("availableRAM is never negative", async () => {
    const info = await detectCapabilities(
      makeDeps(
        makeState({
          totalRAMBytes: FOUR_GB,
          usedRAMBytes: FOUR_GB,
        }),
      ),
    );
    expect(info.availableRAM).toBe(0);
  });
});

describe("gpuBackend", () => {
  test("iOS returns metal", async () => {
    const info = await detectCapabilities(makeDeps(makeState(), "ios"));
    expect(info.gpuBackend).toBe("metal");
  });

  test("Android with Adreno GPU returns opencl", async () => {
    const info = await detectCapabilities(makeDeps(makeState()));
    expect(info.gpuBackend).toBe("opencl");
  });

  test("Android with Mali GPU returns vulkan", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ brand: "Samsung Exynos with Mali" })),
    );
    expect(info.gpuBackend).toBe("vulkan");
  });

  test("hasGPU is false when gpuMemoryMB <= 512", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ totalRAMBytes: 1024 * 1024 * 1024 })), // 1GB
    );
    expect(info.hasGPU).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DeviceDetector class (Sprint 2 - T019-T023)
// ---------------------------------------------------------------------------

const GB = 1024 ** 3;

function makeMockDeviceInfoProvider(overrides?: {
  totalMemory?: number;
  usedMemory?: number;
  brand?: string;
  model?: string;
  osVersion?: string;
  cpuCores?: number;
}): IDeviceInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(overrides?.totalMemory ?? 8 * GB),
    getUsedMemory: () => Promise.resolve(overrides?.usedMemory ?? 2 * GB),
    getBrand: () => Promise.resolve(overrides?.brand ?? "Qualcomm"),
    getModel: () => Promise.resolve(overrides?.model ?? "Pixel 7"),
    getSystemVersion: () => Promise.resolve(overrides?.osVersion ?? "13.0"),
    getNumberOfCPUCores: () => Promise.resolve(overrides?.cpuCores ?? 8),
  };
}

function makeMockPlatformProvider(os: "ios" | "android"): IPlatformProvider {
  return { OS: os };
}

describe("DeviceDetector", () => {
  // T020: OS overhead
  test("iOS overhead is 1.5 GB", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ totalMemory: 8 * GB, usedMemory: 0 }),
      makeMockPlatformProvider("ios"),
    );
    const info = await detector.detect();
    // availableRAM = 8 - 1.5 - 0 = 6.5
    expect(info.availableRAM).toBeCloseTo(6.5, 5);
  });

  test("Android overhead is 2.0 GB", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ totalMemory: 8 * GB, usedMemory: 0 }),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    // availableRAM = 8 - 2.0 - 0 = 6.0
    expect(info.availableRAM).toBeCloseTo(6.0, 5);
  });

  // T019: budget tier (< 5 GB available)
  test("budget tier device has availableRAM < 5", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ totalMemory: 4 * GB, usedMemory: 0 }),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    // availableRAM = 4 - 2.0 - 0 = 2.0 < 5 → budget
    expect(info.availableRAM).toBeLessThan(5);
  });

  // T021/T023: availableRAM negative → clamped to 0
  test("availableRAM is clamped to 0 when memory exceeds total minus overhead", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ totalMemory: 4 * GB, usedMemory: 4 * GB }),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    // totalRAM=4, usedRAM=4, overhead=2 → 4-2-4 = -2 → clamped to 0
    expect(info.availableRAM).toBe(0);
  });

  // T022: availableRAM < 1 GB → hasGPU = false
  test("hasGPU is false when availableRAM is below 1 GB on iOS", async () => {
    const detector = new DeviceDetector(
      // iOS overhead=1.5, used=3 → 4-1.5-3 = -0.5 → clamped to 0 < 1
      makeMockDeviceInfoProvider({ totalMemory: 4 * GB, usedMemory: 3 * GB }),
      makeMockPlatformProvider("ios"),
    );
    const info = await detector.detect();
    expect(info.availableRAM).toBe(0);
    expect(info.hasGPU).toBe(false);
    expect(info.gpuBackend).toBe("none");
  });

  test("hasGPU is true for iOS when availableRAM >= 1 GB", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ totalMemory: 8 * GB, usedMemory: 2 * GB }),
      makeMockPlatformProvider("ios"),
    );
    const info = await detector.detect();
    // availableRAM = 8 - 1.5 - 2 = 4.5 >= 1
    expect(info.hasGPU).toBe(true);
    expect(info.gpuBackend).toBe("Metal");
  });

  test("platform is set correctly for iOS", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider(),
      makeMockPlatformProvider("ios"),
    );
    const info = await detector.detect();
    expect(info.platform).toBe("iOS");
  });

  test("platform is set correctly for Android", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider(),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    expect(info.platform).toBe("Android");
  });

  test("detectedAt is a recent timestamp", async () => {
    const before = Date.now();
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider(),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    const after = Date.now();
    expect(info.detectedAt).toBeGreaterThanOrEqual(before);
    expect(info.detectedAt).toBeLessThanOrEqual(after);
  });

  test("cpuCores is forwarded from provider", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ cpuCores: 6 }),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    expect(info.cpuCores).toBe(6);
  });
});

describe("getTierByRAM", () => {
  test("4GB or less is budget", () => {
    expect(getTierByRAM(2)).toBe("budget");
    expect(getTierByRAM(4)).toBe("budget");
  });

  test("between 4GB and 8GB is midRange", () => {
    expect(getTierByRAM(6)).toBe("midRange");
    expect(getTierByRAM(8)).toBe("midRange");
  });

  test("more than 8GB is premium", () => {
    expect(getTierByRAM(12)).toBe("premium");
    expect(getTierByRAM(16)).toBe("premium");
  });
});

describe("getTierConfig", () => {
  test("budget tier has conservative settings", () => {
    const config = getTierConfig("budget");
    expect(config.n_ctx).toBe(512);
    expect(config.n_gpu_layers).toBe(0);
    expect(config.cache_type_k).toBe("q4_0");
  });

  test("premium tier allows GPU offload", () => {
    const config = getTierConfig("premium");
    expect(config.n_gpu_layers).toBe(99);
    expect(config.use_mlock).toBe(true);
  });
});

describe("buildRuntimeConfig", () => {
  const mockDeviceInfo = {
    totalRAM: 8,
    availableRAM: 4,
    cpuCores: 8,
    performanceCores: 4,
    cpuBrand: "snapdragon" as const,
    hasGPU: true,
    gpuMemoryMB: 2048,
    gpuType: "adreno" as const,
    gpuBackend: "opencl" as const,
    platform: "android" as const,
    osVersion: "14",
    deviceModel: "Pixel 8",
    detectedAt: Date.now(),
  };

  test("creates config with model path", () => {
    const config = buildRuntimeConfig(mockDeviceInfo, "/path/to/model.gguf");
    expect(config.model).toBe("/path/to/model.gguf");
  });

  test("ajusta n_threads para min(cpuCores, 8)", () => {
    const config = buildRuntimeConfig(mockDeviceInfo, "/model.gguf");
    // cpuCores=8, min(8,8)=8
    expect(config.n_threads).toBe(8);
    expect(config.n_threads_batch).toBe(8);
  });

  test("disables GPU layers when hasGPU is false", () => {
    const noGpuDevice = { ...mockDeviceInfo, hasGPU: false };
    const config = buildRuntimeConfig(noGpuDevice, "/model.gguf");
    expect(config.n_gpu_layers).toBe(0);
  });

  test("applies overrides", () => {
    const config = buildRuntimeConfig(mockDeviceInfo, "/model.gguf", {
      temperature: 0.5,
      n_ctx: 1024,
    });
    expect(config.temperature).toBe(0.5);
    expect(config.n_ctx).toBe(1024);
  });

  test("adjusts batch size based on available RAM", () => {
    const lowRamDevice = { ...mockDeviceInfo, availableRAM: 1 };
    const config = buildRuntimeConfig(lowRamDevice, "/model.gguf");
    expect(config.n_batch).toBeLessThan(512);
  });
});
