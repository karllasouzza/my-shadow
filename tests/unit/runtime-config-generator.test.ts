import {
    RuntimeConfigGenerator,
    validateCacheType,
    validateRuntimeConfig,
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
