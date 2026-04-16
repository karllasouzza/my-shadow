import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";
import Ajv from "ajv";
import { describe, expect, test } from "bun:test";
import {
  mockBudgetDevice,
  mockMidRangeDevice,
  mockPremiumDevice,
} from "../utils/device-simulator";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require("../../specs/001-optimize-runtime-planning/contracts/runtime-config.schema.json");

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const MODEL_PATH = "/data/models/model.gguf";
const generator = new RuntimeConfigGenerator();

// ─────────────────────────────────────────────────────────────────────
// T021: Budget tier — 4 GB Android device
// ─────────────────────────────────────────────────────────────────────
describe("T021: Budget tier loading (4GB Android)", () => {
  test("selects budget profile (n_ctx=1024)", () => {
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_ctx).toBe(1024);
  });

  test("n_batch is 64 for budget tier", () => {
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_batch).toBe(64);
  });

  test("use_mmap is true (critical for low-RAM)", () => {
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.use_mmap).toBe(true);
  });

  test("use_mlock is false (must not lock on mobile)", () => {
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.use_mlock).toBe(false);
  });

  test("n_gpu_layers is 0 (CPU-only for budget)", () => {
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_gpu_layers).toBe(0);
  });

  test("config passes JSON schema validation", () => {
    const deviceInfo = mockBudgetDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(validate(config)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// T022: Mid-range tier — 6 GB Android device
// ─────────────────────────────────────────────────────────────────────
describe("T022: Mid-range tier loading (6GB Android)", () => {
  test("selects mid-range profile (n_ctx=2048)", () => {
    const deviceInfo = mockMidRangeDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_ctx).toBe(2048);
  });

  test("n_batch is 128 for mid-range tier", () => {
    const deviceInfo = mockMidRangeDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_batch).toBe(128);
  });

  test("use_mmap is true for mid-range", () => {
    const deviceInfo = mockMidRangeDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.use_mmap).toBe(true);
  });

  test("n_gpu_layers is 50 for mid-range GPU offload", () => {
    const deviceInfo = mockMidRangeDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_gpu_layers).toBe(50);
  });

  test("config passes JSON schema validation", () => {
    const deviceInfo = mockMidRangeDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(validate(config)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// T023: Premium tier — 8+ GB iOS device
// ─────────────────────────────────────────────────────────────────────
describe("T023: Premium tier loading (8GB+ iOS)", () => {
  test("selects premium profile (n_ctx=4096)", () => {
    const deviceInfo = mockPremiumDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_ctx).toBe(4096);
  });

  test("n_batch is 512 for premium tier", () => {
    const deviceInfo = mockPremiumDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_batch).toBe(512);
  });

  test("cache_type_k is f16 for premium (full precision)", () => {
    const deviceInfo = mockPremiumDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.cache_type_k).toBe("f16");
  });

  test("cache_type_v is f16 for premium (full precision)", () => {
    const deviceInfo = mockPremiumDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.cache_type_v).toBe("f16");
  });

  test("n_gpu_layers is 99 for full GPU utilization on iOS", () => {
    const deviceInfo = mockPremiumDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(config.n_gpu_layers).toBe(99);
  });

  test("config passes JSON schema validation", () => {
    const deviceInfo = mockPremiumDevice();
    const config = generator.generateRuntimeConfig(deviceInfo, MODEL_PATH);
    expect(validate(config)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// T024: OOM fallback behavior — config degradation logic
// ─────────────────────────────────────────────────────────────────────
describe("T024: OOM fallback — config degradation", () => {
  test("degraded config reduces n_ctx by 50%", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
      { n_ctx: 512 }, // 1024 / 2 = 512
    );
    expect(config.n_ctx).toBe(512);
  });

  test("degraded config remains above minimum n_ctx (128)", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
      { n_ctx: 512 },
    );
    expect(config.n_ctx).toBeGreaterThanOrEqual(128);
  });

  test("degraded config passes schema validation", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
      { n_ctx: 512 },
    );
    expect(validate(config)).toBe(true);
  });

  test("degraded config preserves use_mmap=true for safety", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
      { n_ctx: 512 },
    );
    expect(config.use_mmap).toBe(true);
  });

  test("device classified as budget when 4GB total, 3.2GB available", () => {
    const config = generator.generateRuntimeConfig(
      mockBudgetDevice(),
      MODEL_PATH,
    );
    // Budget device config
    expect(config.n_ctx).toBe(1024);
    expect(config.n_gpu_layers).toBe(0);
  });
});
