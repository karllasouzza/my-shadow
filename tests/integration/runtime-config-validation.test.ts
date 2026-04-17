import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";
import type { RuntimeConfig } from "@/shared/ai/types";
import {
    mockBudgetDevice,
    mockMidRangeDevice,
    mockPremiumDevice,
} from "@/tests/utils/device-simulator";
import Ajv from "ajv";
import { describe, expect, test } from "bun:test";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require("../../specs/001-optimize-runtime-planning/contracts/runtime-config.schema.json");

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const generator = new RuntimeConfigGenerator();
const MODEL_PATH = "/data/models/model.gguf";

function generateAndValidate(
  deviceSimulator: () => ReturnType<typeof mockBudgetDevice>,
) {
  const config = generator.generateRuntimeConfig(deviceSimulator(), MODEL_PATH);
  const valid = validate(config);
  return { config, valid, errors: validate.errors ?? [] };
}

describe("RuntimeConfig: JSON Schema validation", () => {
  describe("Budget tier (4GB device)", () => {
    test("passes schema validation", () => {
      const { valid, errors } = generateAndValidate(mockBudgetDevice);
      expect(errors.map((e) => `${e.dataPath} ${e.message}`)).toEqual([]);
      expect(valid).toBe(true);
    });

    test("has correct n_ctx for budget (1024)", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.n_ctx).toBe(1024);
    });

    test("has correct n_batch for budget (64)", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.n_batch).toBe(64);
    });

    test("has use_mmap=true (required on low-RAM)", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.use_mmap).toBe(true);
    });

    test("has use_mlock=false (required on mobile)", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.use_mlock).toBe(false);
    });

    test("cache_type_k is q8_0 for budget", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.cache_type_k).toBe("q8_0");
    });

    test("cache_type_v is q8_0 for budget", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.cache_type_v).toBe("q8_0");
    });

    test("n_gpu_layers is 0 (CPU-only for budget)", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.n_gpu_layers).toBe(0);
    });
  });

  describe("Mid-range tier (6GB device)", () => {
    test("passes schema validation", () => {
      const { valid, errors } = generateAndValidate(mockMidRangeDevice);
      expect(errors.map((e) => `${e.dataPath} ${e.message}`)).toEqual([]);
      expect(valid).toBe(true);
    });

    test("has correct n_ctx for mid-range (2048)", () => {
      const { config } = generateAndValidate(mockMidRangeDevice);
      expect(config.n_ctx).toBe(2048);
    });

    test("has correct n_batch for mid-range (128)", () => {
      const { config } = generateAndValidate(mockMidRangeDevice);
      expect(config.n_batch).toBe(128);
    });
  });

  describe("Premium tier (8GB device)", () => {
    test("passes schema validation", () => {
      const { valid, errors } = generateAndValidate(mockPremiumDevice);
      expect(errors.map((e) => `${e.dataPath} ${e.message}`)).toEqual([]);
      expect(valid).toBe(true);
    });

    test("has correct n_ctx for premium (4096)", () => {
      const { config } = generateAndValidate(mockPremiumDevice);
      expect(config.n_ctx).toBe(4096);
    });

    test("cache_type_k is f16 for premium", () => {
      const { config } = generateAndValidate(mockPremiumDevice);
      expect(config.cache_type_k).toBe("f16");
    });

    test("n_gpu_layers is 99 for premium (full GPU)", () => {
      const { config } = generateAndValidate(mockPremiumDevice);
      expect(config.n_gpu_layers).toBe(99);
    });
  });

  describe("Schema constraint enforcement", () => {
    test("rejects n_ctx below minimum (128)", () => {
      const invalidConfig = {
        ...generator.generateRuntimeConfig(mockBudgetDevice(), MODEL_PATH),
        n_ctx: 64,
      };
      const valid = validate(invalidConfig);
      expect(valid).toBe(false);
      expect(validate.errors?.some((e) => e.dataPath.includes("n_ctx"))).toBe(
        true,
      );
    });

    test("rejects n_ctx above maximum (8192)", () => {
      const invalidConfig = {
        ...generator.generateRuntimeConfig(mockBudgetDevice(), MODEL_PATH),
        n_ctx: 16384,
      };
      const valid = validate(invalidConfig);
      expect(valid).toBe(false);
    });

    test("rejects invalid cache_type_k", () => {
      const invalidConfig = {
        ...generator.generateRuntimeConfig(mockBudgetDevice(), MODEL_PATH),
        cache_type_k: "bf16",
      };
      const valid = validate(invalidConfig);
      expect(valid).toBe(false);
    });

    test("rejects missing required field (model)", () => {
      const config: Partial<RuntimeConfig> = generator.generateRuntimeConfig(
        mockBudgetDevice(),
        MODEL_PATH,
      );
      const { model: _, ...noModel } = config;
      const valid = validate(noModel);
      expect(valid).toBe(false);
    });
  });

  describe("Adaptive field validation", () => {
    test("budget config includes n_predict", () => {
      const { config } = generateAndValidate(mockBudgetDevice);
      expect(config.n_predict).toBeDefined();
      expect(config.n_predict).toBe(512);
    });

    test("premium config includes n_predict=2048", () => {
      const { config } = generateAndValidate(mockPremiumDevice);
      expect(config.n_predict).toBe(2048);
    });

    test("all tiers set n_parallel to 0", () => {
      for (const factory of [
        mockBudgetDevice,
        mockMidRangeDevice,
        mockPremiumDevice,
      ]) {
        const { config } = generateAndValidate(factory);
        expect(config.n_parallel).toBe(0);
      }
    });

    test("all tiers include sampling params (min_p, top_k, top_p)", () => {
      for (const factory of [
        mockBudgetDevice,
        mockMidRangeDevice,
        mockPremiumDevice,
      ]) {
        const { config } = generateAndValidate(factory);
        expect(config.min_p).toBe(0.05);
        expect(config.top_k).toBe(40);
        expect(config.top_p).toBe(0.9);
      }
    });

    test("adaptive fields pass schema validation for all tiers", () => {
      for (const factory of [
        mockBudgetDevice,
        mockMidRangeDevice,
        mockPremiumDevice,
      ]) {
        const { valid, errors } = generateAndValidate(factory);
        expect(errors.map((e) => `${e.dataPath} ${e.message}`)).toEqual([]);
        expect(valid).toBe(true);
      }
    });
  });
});
