import {
  RuntimeConfigGenerator,
  validateCacheType,
  validateRuntimeConfig,
  selectGpuBackend,
  probeGpuBackend,
} from "@/shared/ai/runtime-config-generator";
import {
  mockBudgetDevice,
  mockDeviceInfo,
  mockMidRangeDevice,
  mockPremiumDevice,
} from "@/tests/utils/device-simulator";
import { describe, expect, test } from "bun:test";

const MODEL_PATH = "/models/model.gguf";

describe("validateCacheType", () => {
  test("accepts f16", () => expect(validateCacheType("f16")).toBe(true));
  test("accepts q8_0", () => expect(validateCacheType("q8_0")).toBe(true));
  test("accepts q4_0", () => expect(validateCacheType("q4_0")).toBe(true));
  test("rejects unknown value", () =>
    expect(validateCacheType("bf16")).toBe(false));
  test("rejects empty string", () => expect(validateCacheType("")).toBe(false));
});

describe("validateRuntimeConfig", () => {
  test("returns empty array for valid config", () => {
    const errors = validateRuntimeConfig({
      n_ctx: 2048,
      n_batch: 128,
      n_threads: 6,
    });
    expect(errors).toHaveLength(0);
  });

  test("rejects n_ctx below 128", () => {
    const errors = validateRuntimeConfig({ n_ctx: 64 });
    expect(errors.some((e) => e.includes("n_ctx"))).toBe(true);
  });

  test("rejects n_ctx above 8192", () => {
    const errors = validateRuntimeConfig({ n_ctx: 16384 });
    expect(errors.some((e) => e.includes("n_ctx"))).toBe(true);
  });

  test("rejects n_batch below 32", () => {
    const errors = validateRuntimeConfig({ n_batch: 16 });
    expect(errors.some((e) => e.includes("n_batch"))).toBe(true);
  });

  test("rejects n_threads below 1", () => {
    const errors = validateRuntimeConfig({ n_threads: 0 });
    expect(errors.some((e) => e.includes("n_threads"))).toBe(true);
  });

  test("rejects invalid cache_type_k", () => {
    const errors = validateRuntimeConfig({ cache_type_k: "bf16" as never });
    expect(errors.some((e) => e.includes("cache_type_k"))).toBe(true);
  });

  test("rejects invalid cache_type_v", () => {
    const errors = validateRuntimeConfig({ cache_type_v: "q2_k" as never });
    expect(errors.some((e) => e.includes("cache_type_v"))).toBe(true);
  });

  test("can have multiple errors", () => {
    const errors = validateRuntimeConfig({ n_ctx: 64, n_batch: 4 });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("RuntimeConfigGenerator.generateRuntimeConfig", () => {
  const generator = new RuntimeConfigGenerator();

  test("returns config with model path set", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.model).toBe(MODEL_PATH);
  });

  test("budget device gets n_ctx=1024", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.n_ctx).toBe(1024);
  });

  test("budget device uses CPU only (n_gpu_layers=0)", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.n_gpu_layers).toBe(0);
  });

  test("budget device uses q8_0 KV cache", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.cache_type_k).toBe("q8_0");
    expect(config.cache_type_v).toBe("q8_0");
  });

  test("mid-range device gets n_ctx=2048", () => {
    const config = generator.generateRuntimeConfig(
      mockMidRangeDevice(),
      MODEL_PATH,
    );
    expect(config.n_ctx).toBe(2048);
  });

  test("premium device gets n_ctx=4096", () => {
    const config = generator.generateRuntimeConfig(
      mockPremiumDevice(),
      MODEL_PATH,
    );
    expect(config.n_ctx).toBe(4096);
  });

  test("premium device uses f16 KV cache", () => {
    const config = generator.generateRuntimeConfig(
      mockPremiumDevice(),
      MODEL_PATH,
    );
    expect(config.cache_type_k).toBe("f16");
    expect(config.cache_type_v).toBe("f16");
  });

  test("n_threads is capped at cpuCores", () => {
    const device = mockDeviceInfo({ cpuCores: 2 });
    const config = generator.generateRuntimeConfig(device, MODEL_PATH);
    expect(config.n_threads).toBeLessThanOrEqual(2);
  });

  test("overrides take precedence over profile defaults", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
      {
        n_ctx: 512,
        temperature: 0.1,
      },
    );
    expect(config.n_ctx).toBe(512);
    expect(config.temperature).toBe(0.1);
  });

  test("overrides do not change model path", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
      {
        model: "/wrong/path.gguf",
      },
    );
    expect(config.model).toBe(MODEL_PATH);
  });

  test("use_mmap is true (required for low-RAM devices)", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.use_mmap).toBe(true);
  });

  test("use_mlock is false (never lock on mobile)", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.use_mlock).toBe(false);
  });
});

describe("RuntimeConfigGenerator.selectDeviceProfile", () => {
  const generator = new RuntimeConfigGenerator();

  test("budget device gets budget profile", () => {
    const profile = generator.selectDeviceProfile(mockBudgetDevice());
    expect(profile.tier).toBe("budget");
  });

  test("mid-range device gets midRange profile", () => {
    const profile = generator.selectDeviceProfile(mockMidRangeDevice());
    expect(profile.tier).toBe("midRange");
  });

  test("premium device gets premium profile", () => {
    const profile = generator.selectDeviceProfile(mockPremiumDevice());
    expect(profile.tier).toBe("premium");
  });
});

describe("RuntimeConfigGenerator.generateThreadCount", () => {
  const generator = new RuntimeConfigGenerator();

  test("returns min(cpuCores, 8)", () => {
    const device = mockDeviceInfo({ cpuCores: 4 });
    expect(generator.generateThreadCount(device)).toBe(4);
  });

  test("caps at 8 for devices with many cores", () => {
    const device = mockDeviceInfo({ cpuCores: 12 });
    expect(generator.generateThreadCount(device)).toBe(8);
  });

  test("budget device gets correct thread count", () => {
    // mockBudgetDevice has cpuCores: 4
    expect(generator.generateThreadCount(mockBudgetDevice())).toBe(4);
  });

  test("T082 device with 12 cores → n_threads capped at 8", () => {
    const device = mockDeviceInfo({ cpuCores: 12 });
    expect(generator.generateThreadCount(device)).toBe(8);
  });

  test("T083 device with 4 cores → n_threads = 4", () => {
    const device = mockDeviceInfo({ cpuCores: 4 });
    expect(generator.generateThreadCount(device)).toBe(4);
  });

  test("T084 device with 0 cores → n_threads clamped to 1", () => {
    const device = mockDeviceInfo({ cpuCores: 0 });
    expect(generator.generateThreadCount(device)).toBe(1);
  });
});

describe("RuntimeConfigGenerator.calculateOptimalBatch", () => {
  const generator = new RuntimeConfigGenerator();

  test("is bounded by context/2", () => {
    const batch = generator.calculateOptimalBatch(256, 8 * 1024 ** 3);
    expect(batch).toBeLessThanOrEqual(128);
  });

  test("is bounded by 512 max", () => {
    const batch = generator.calculateOptimalBatch(4096, 16 * 1024 ** 3);
    expect(batch).toBeLessThanOrEqual(512);
  });

  test("has a floor of 64", () => {
    const batch = generator.calculateOptimalBatch(128, 0.1 * 1024 ** 3);
    expect(batch).toBeGreaterThanOrEqual(64);
  });

  test("30% RAM constraint bounds result", () => {
    const batch = generator.calculateOptimalBatch(4096, 1 * 1024 ** 3);
    expect(batch).toBeLessThanOrEqual(512);
    expect(batch).toBeGreaterThanOrEqual(64);
  });
});

describe("RuntimeConfigGenerator.getAdaptiveNPredict", () => {
  const generator = new RuntimeConfigGenerator();

  test("returns 512 when ratio < 1 (severe constraint)", () => {
    expect(generator.getAdaptiveNPredict(4, 2 * 1024 ** 3)).toBe(512);
  });

  test("returns 1024 when ratio is between 1 and 2", () => {
    expect(generator.getAdaptiveNPredict(2, 6 * 1024 ** 3)).toBe(1024);
  });

  test("returns 2048 when ratio >= 2 (mobile max)", () => {
    expect(generator.getAdaptiveNPredict(1, 8 * 1024 ** 3)).toBe(2048);
  });
});

describe("RuntimeConfigGenerator sampling defaults", () => {
  const generator = new RuntimeConfigGenerator();

  test("budget profile includes sampling params", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.top_k).toBe(40);
    expect(config.top_p).toBe(0.9);
    expect(config.min_p).toBe(0.05);
  });

  test("all profiles set n_parallel to 0", () => {
    for (const device of [
      mockBudgetDevice(),
      mockMidRangeDevice(),
      mockPremiumDevice(),
    ]) {
      const config = generator.generateRuntimeConfig(device, MODEL_PATH);
      expect(config.n_parallel).toBe(0);
    }
  });

  test("budget tier dry_penalty_last_n is 32", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.dry_penalty_last_n).toBe(32);
  });

  test("mid-range tier dry_penalty_last_n is 48", () => {
    const config = generator.generateRuntimeConfig(
      mockMidRangeDevice(),
      MODEL_PATH,
    );
    expect(config.dry_penalty_last_n).toBe(48);
  });

  test("premium tier dry_penalty_last_n is 64", () => {
    const config = generator.generateRuntimeConfig(
      mockPremiumDevice(),
      MODEL_PATH,
    );
    expect(config.dry_penalty_last_n).toBe(64);
  });
});

describe("RuntimeConfigGenerator.calculateGpuLayers", () => {
  const generator = new RuntimeConfigGenerator();

  test("returns 0 for CPU-only devices", () => {
    const device = mockDeviceInfo({ hasGPU: false, gpuBackend: null });
    expect(generator.calculateGpuLayers(device, 50)).toBe(0);
  });

  test("returns tier default for GPU devices", () => {
    const device = mockDeviceInfo({ hasGPU: true, gpuBackend: "metal" });
    expect(generator.calculateGpuLayers(device, 99)).toBe(99);
  });

  test("returns tier default for GPU devices without gpuMemoryMB", () => {
    const device = mockDeviceInfo({ hasGPU: true, gpuBackend: "opencl" });
    expect(generator.calculateGpuLayers(device, 50)).toBe(50);
  });
});

describe("RuntimeConfigGenerator.validateCacheConfig", () => {
  const generator = new RuntimeConfigGenerator();

  test("validates f16 + f16", () => {
    expect(generator.validateCacheConfig("f16", "f16")).toBe(true);
  });

  test("validates q8_0 + q8_0", () => {
    expect(generator.validateCacheConfig("q8_0", "q8_0")).toBe(true);
  });

  test("rejects invalid cache type", () => {
    expect(generator.validateCacheConfig("invalid", "f16")).toBe(false);
  });

  test("budget tier gets q8_0 for both K and V", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    expect(config.cache_type_k).toBe("q8_0");
    expect(config.cache_type_v).toBe("q8_0");
  });

  test("premium tier gets f16 for both K and V", () => {
    const config = generator.generateRuntimeConfig(
      mockPremiumDevice(),
      MODEL_PATH,
    );
    expect(config.cache_type_k).toBe("f16");
    expect(config.cache_type_v).toBe("f16");
  });

  test("flash_attn enabled on GPU-capable devices", () => {
    const device = mockPremiumDevice();
    expect(device.gpuBackend).not.toBeNull();
    expect(device.hasGPU).toBe(true);
  });

  test("flash_attn disabled on CPU-only devices", () => {
    const device = mockBudgetDevice();
    expect(device.gpuBackend).toBe("none");
  });
});

describe("selectGpuBackend", () => {
  test("iOS always returns Metal", () => {
    expect(selectGpuBackend("17.0", "Apple", "ios")).toBe("Metal");
  });

  test("Android 13+ Snapdragon returns Vulkan", () => {
    expect(selectGpuBackend("13.0", "Snapdragon 8 Gen 2", "android")).toBe(
      "Vulkan",
    );
  });

  test("Android 12 Snapdragon returns OpenCL (not Vulkan)", () => {
    expect(selectGpuBackend("12.0", "Snapdragon 888", "android")).toBe(
      "OpenCL",
    );
  });

  test("Android 13 non-Snapdragon (Samsung Exynos) returns OpenCL", () => {
    expect(
      selectGpuBackend("13.0", "Samsung Exynos 2200", "android"),
    ).toBe("OpenCL");
  });

  test("Android unknown GPU vendor returns OpenCL", () => {
    expect(selectGpuBackend("13.0", "MediaTek Helio G99", "android")).toBe(
      "OpenCL",
    );
  });

  test("Android 13 with Adreno (Qualcomm) returns Vulkan", () => {
    expect(selectGpuBackend("13.0", "Qualcomm Adreno 740", "android")).toBe(
      "Vulkan",
    );
  });

  test("T119 unknown GPU vendor falls back to OpenCL", () => {
    // "UnknownBrand X1" matches no Snapdragon pattern → OpenCL is the safe fallback
    expect(selectGpuBackend("17.0", "UnknownBrand X1", "android")).toBe(
      "OpenCL",
    );
  });
});

describe("probeGpuBackend", () => {
  test("returns false for 'none'", async () => {
    const result = await probeGpuBackend("none");
    expect(result).toBe(false);
  });

  test("returns true for valid backend (simulated success)", async () => {
    const result = await probeGpuBackend("Metal");
    expect(result).toBe(true);
  });

  test("returns true for Vulkan backend", async () => {
    const result = await probeGpuBackend("Vulkan");
    expect(result).toBe(true);
  });

  test("returns true for OpenCL backend", async () => {
    const result = await probeGpuBackend("OpenCL");
    expect(result).toBe(true);
  });
});

describe("flash_attn configuration", () => {
  const generator = new RuntimeConfigGenerator();

  test("iOS Metal device gets flash_attn=true", () => {
    const config = generator.generateRuntimeConfig(
      mockPremiumDevice(),
      MODEL_PATH,
    );
    expect(config.flash_attn).toBe(true);
  });

  test("Android device gets flash_attn=false", () => {
    const config = generator.generateRuntimeConfig(
      mockMidRangeDevice(),
      MODEL_PATH,
    );
    expect(config.flash_attn).toBe(false);
  });

  test("iOS device without GPU gets flash_attn=false", () => {
    const device = mockDeviceInfo({
      platform: "ios",
      hasGPU: false,
      gpuBackend: null,
    });
    const config = generator.generateRuntimeConfig(device, MODEL_PATH);
    expect(config.flash_attn).toBe(false);
  });
});
