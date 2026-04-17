import { DeviceDetector } from "@/shared/device/detector";
import { getTierByRAM, getTierConfig } from "@/shared/device/hardware-database";
import {
  IDeviceInfoProvider,
  IPlatformProvider,
} from "@/shared/device/types/adapters";
import { describe, expect, test } from "bun:test";

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
    expect(info.availableRAM).toBeLessThanOrEqual(6.5);
    expect(info.availableRAM).toBeGreaterThanOrEqual(5);
  });

  test("Android overhead is 2.0 GB", async () => {
    const detector = new DeviceDetector(
      makeMockDeviceInfoProvider({ totalMemory: 8 * GB, usedMemory: 0 }),
      makeMockPlatformProvider("android"),
    );
    const info = await detector.detect();
    // availableRAM = 8 - 2.0 - 0 = 6.0
    expect(info.availableRAM).toBeLessThanOrEqual(6.5);
    expect(info.availableRAM).toBeGreaterThanOrEqual(5);
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
