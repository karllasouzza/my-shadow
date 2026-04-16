import { buildRuntimeConfig } from "@/shared/device/config-builder";
import { detectCapabilities } from "@/shared/device/detector";
import { getTierByRAM, getTierConfig, resolveCpuProfile, resolveGpuProfile } from "@/shared/device/hardware-database";
import { DetectionDeps, SystemState } from "@/shared/device/types";
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

  test("on Android, gpuType is resolved from brand", async () => {
    const info = await detectCapabilities(makeDeps(makeState()));
    expect(info.gpuType).toBe("adreno");
  });

  test("on iOS, GPU is metal and hasGPU=true", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ totalRAMBytes: EIGHT_GB }), "ios"),
    );
    expect(info.gpuType).toBe("metal");
    expect(info.hasGPU).toBe(true);
  });

  test("on iOS, cpuBrand is bionic", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ totalRAMBytes: EIGHT_GB }), "ios"),
    );
    expect(info.cpuBrand).toBe("bionic");
  });

  test("on Android with Qualcomm brand, cpuBrand is snapdragon", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ brand: "Qualcomm Snapdragon" })),
    );
    expect(info.cpuBrand).toBe("snapdragon");
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

describe("performanceCores", () => {
  test("iOS uses 50% of cores", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ cpuCores: 6 }), "ios"),
    );
    expect(info.performanceCores).toBe(3);
  });

  test("Android Snapdragon uses 37.5% of cores", async () => {
    const info = await detectCapabilities(
      makeDeps(
        makeState({
          cpuCores: 8,
          brand: "Qualcomm",
        }),
      ),
    );
    expect(info.performanceCores).toBe(3);
  });

  test("Android Helio uses 50% with floor of 2", async () => {
    const info = await detectCapabilities(
      makeDeps(
        makeState({
          cpuCores: 4,
          brand: "MediaTek Helio",
        }),
      ),
    );
    expect(info.performanceCores).toBe(2);
  });

  test("performance cores is at least 2 for unknown brand", async () => {
    const info = await detectCapabilities(
      makeDeps(
        makeState({
          cpuCores: 2,
          brand: "Unknown",
        }),
      ),
    );
    expect(info.performanceCores).toBe(2);
  });

  test("performance cores capped at 8", async () => {
    const info = await detectCapabilities(
      makeDeps(makeState({ cpuCores: 16 }), "ios"),
    );
    expect(info.performanceCores).toBe(8);
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

describe("resolveCpuProfile", () => {
  test("detects Snapdragon from brand string", () => {
    const profile = resolveCpuProfile("Qualcomm Snapdragon 8 Gen 2");
    expect(profile.brand).toBe("snapdragon");
    expect(profile.performanceCoreRatio).toBe(0.375);
  });

  test("detects Bionic from Apple", () => {
    const profile = resolveCpuProfile("Apple iPhone15,2");
    expect(profile.brand).toBe("bionic");
  });

  test("defaults to unknown with 50% ratio", () => {
    const profile = resolveCpuProfile("Some Unknown Brand");
    expect(profile.brand).toBe("unknown");
    expect(profile.performanceCoreRatio).toBe(0.5);
  });
});

describe("resolveGpuProfile", () => {
  test("iOS always returns Metal", () => {
    const profile = resolveGpuProfile("ios");
    expect(profile.type).toBe("metal");
    expect(profile.backend).toBe("metal");
    expect(profile.vramFraction).toBe(1.0);
  });

  test("detects Adreno from brand", () => {
    const profile = resolveGpuProfile("android", "Qualcomm Snapdragon");
    expect(profile.type).toBe("adreno");
    expect(profile.backend).toBe("opencl");
  });

  test("detects Mali from brand", () => {
    const profile = resolveGpuProfile(
      "android",
      "Samsung Exynos with Mali-G78",
    );
    expect(profile.type).toBe("mali");
    expect(profile.backend).toBe("vulkan");
  });

  test("returns unknown backend for unrecognized GPU", () => {
    const profile = resolveGpuProfile("android", "Some GPU");
    expect(profile.backend).toBeNull();
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

  test("adjusts n_threads to performance cores", () => {
    const config = buildRuntimeConfig(mockDeviceInfo, "/model.gguf");
    expect(config.n_threads).toBe(4);
    expect(config.n_threads_batch).toBe(4);
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
