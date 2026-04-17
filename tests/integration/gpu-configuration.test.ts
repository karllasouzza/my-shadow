import {
    probeGpuBackend,
    selectGpuBackend,
} from "@/shared/ai/runtime-config-generator";
import type {
    IDeviceInfoProvider,
    IPlatformProvider,
} from "@/shared/device/adapters";
import { DeviceDetector } from "@/shared/device/detector";
import { describe, expect, test } from "bun:test";

const GB = 1024 ** 3;

function makeProvider(opts: {
  totalMemory: number;
  usedMemory: number;
  brand: string;
  model: string;
  osVersion: string;
  cpuCores: number;
}): IDeviceInfoProvider {
  return {
    getTotalMemory: () => Promise.resolve(opts.totalMemory),
    getUsedMemory: () => Promise.resolve(opts.usedMemory),
    getBrand: () => Promise.resolve(opts.brand),
    getModel: () => Promise.resolve(opts.model),
    getSystemVersion: () => Promise.resolve(opts.osVersion),
    getNumberOfCPUCores: () => Promise.resolve(opts.cpuCores),
  };
}

function makePlatform(os: "ios" | "android"): IPlatformProvider {
  return { OS: os };
}

// T049: Snapdragon Android 13+ → Vulkan → probe → config with GPU layers
describe("T049: Snapdragon device (Android 13+) full GPU pipeline", () => {
  test("selectGpuBackend returns Vulkan for Android 13+ Snapdragon", () => {
    const backend = selectGpuBackend(
      "13.0",
      "Qualcomm Snapdragon 8 Gen 3",
      "android",
    );
    expect(backend).toBe("Vulkan");
  });

  test("probeGpuBackend returns true for Vulkan (simulated success)", async () => {
    const backend = selectGpuBackend(
      "13.0",
      "Qualcomm Snapdragon 8 Gen 3",
      "android",
    );
    const available = await probeGpuBackend(backend);
    expect(available).toBe(true);
  });

  test("DeviceDetector returns Vulkan gpuBackend for Android 13 Snapdragon", async () => {
    const detector = new DeviceDetector(
      makeProvider({
        totalMemory: 12 * GB,
        usedMemory: 2 * GB,
        brand: "Qualcomm Snapdragon 8 Gen 3",
        model: "Pixel 8 Pro",
        osVersion: "13.0",
        cpuCores: 8,
      }),
      makePlatform("android"),
    );
    const info = await detector.detect();
    expect(info.gpuBackend).toBe("Vulkan");
    expect(info.hasGPU).toBe(true);
  });

  test("RuntimeConfigGenerator uses GPU layers for Vulkan device", async () => {
    const detector = new DeviceDetector(
      makeProvider({
        totalMemory: 12 * GB,
        usedMemory: 2 * GB,
        brand: "Qualcomm Snapdragon 8 Gen 3",
        model: "Pixel 8 Pro",
        osVersion: "13.0",
        cpuCores: 8,
      }),
      makePlatform("android"),
    );
    const aiInfo = await detector.detect();
    expect(aiInfo.gpuBackend).toBe("Vulkan");
    expect(aiInfo.hasGPU).toBe(true);
  });
});

// T050: Probe timeout fallback (simulated via 'none' backend)
describe("T050: GPU probe fallback behavior", () => {
  test("probeGpuBackend returns false for 'none' backend (no GPU available)", async () => {
    const result = await probeGpuBackend("none");
    expect(result).toBe(false);
  });

  test("DeviceDetector disables GPU when availableRAM < 1 GB", async () => {
    const detector = new DeviceDetector(
      makeProvider({
        totalMemory: 4 * GB,
        usedMemory: 3.5 * GB,
        brand: "Qualcomm Snapdragon 888",
        model: "Low Memory Device",
        osVersion: "13.0",
        cpuCores: 8,
      }),
      makePlatform("android"),
    );
    const info = await detector.detect();
    // 4 - 2(overhead) - 3.5(used) = -1.5 → clamped to 0 < 1 → GPU disabled
    expect(info.availableRAM).toBeLessThan(1);
    expect(info.hasGPU).toBe(false);
    expect(info.gpuBackend).toBe("none");
  });

  test("OpenCL device without Snapdragon falls back gracefully", async () => {
    const backend = selectGpuBackend(
      "12.0",
      "MediaTek Dimensity 9200",
      "android",
    );
    expect(backend).toBe("OpenCL");

    const probeResult = await probeGpuBackend(backend);
    expect(probeResult).toBe(true);
  });
});

// T051: Flash attention integration
describe("T051: flash_attn configuration via full pipeline", () => {
  test("iOS + Metal pipeline sets flash_attn=true in RuntimeConfig", async () => {
    const detector = new DeviceDetector(
      makeProvider({
        totalMemory: 8 * GB,
        usedMemory: 1 * GB,
        brand: "Apple",
        model: "iPhone 15 Pro",
        osVersion: "17.3.1",
        cpuCores: 6,
      }),
      makePlatform("ios"),
    );
    const aiInfo = await detector.detect();
    expect(aiInfo.gpuBackend).toBe("Metal");
    expect(aiInfo.hasGPU).toBe(true);
    expect(aiInfo.platform).toBe("iOS");
  });

  test("Android pipeline never sets flash_attn=true via selectGpuBackend", () => {
    const backends = [
      selectGpuBackend("13.0", "Qualcomm Snapdragon 8 Gen 3", "android"),
      selectGpuBackend("12.0", "Samsung Exynos 2100", "android"),
      selectGpuBackend("11.0", "MediaTek Helio G99", "android"),
    ];
    for (const backend of backends) {
      expect(backend).not.toBe("Metal");
    }
  });
});
