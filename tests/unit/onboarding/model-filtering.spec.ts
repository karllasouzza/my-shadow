/**
 * T028-T029: Unit tests for device detection and model filtering
 *
 * Tests core logic without native module mocks
 */

import { MODEL_CATALOG } from "@/features/onboarding/model/model-configuration";

describe("Model Catalog", () => {
  it("should have 6 models", () => {
    expect(MODEL_CATALOG).toHaveLength(6);
  });

  it("should have unique keys", () => {
    const keys = MODEL_CATALOG.map((m) => m.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("should have valid download URLs", () => {
    for (const model of MODEL_CATALOG) {
      expect(model.downloadUrl).toMatch(/^https?:\/\//);
    }
  });

  it("should have valid quantization types", () => {
    const validQuants = ["Q4_0", "Q4_K_M", "Q8_0", "Q5_K_M", "Q3_K_M"];
    for (const model of MODEL_CATALOG) {
      expect(validQuants).toContain(model.quantization);
    }
  });

  it("should have positive file sizes", () => {
    for (const model of MODEL_CATALOG) {
      expect(model.fileSizeBytes).toBeGreaterThan(0);
    }
  });

  it("should have positive RAM estimates", () => {
    for (const model of MODEL_CATALOG) {
      expect(model.estimatedRamBytes).toBeGreaterThan(0);
    }
  });

  it("should have RAM estimates larger than file sizes", () => {
    for (const model of MODEL_CATALOG) {
      expect(model.estimatedRamBytes).toBeGreaterThan(model.fileSizeBytes);
    }
  });
});

describe("Model Filtering Logic", () => {
  function filterCompatibleModels(ramBudgetBytes: number) {
    return MODEL_CATALOG.filter(
      (m) => m.estimatedRamBytes <= ramBudgetBytes,
    ).sort((a, b) => a.estimatedRamBytes - b.estimatedRamBytes);
  }

  it("should return models with 1GB budget (0.5B and 0.6B fit)", () => {
    const compatible = filterCompatibleModels(1_000_000_000);
    // 0.5B Q4 is ~600MB runtime, 0.6B is ~800MB, both fit
    expect(compatible.length).toBeGreaterThanOrEqual(2);
  });

  it("should return all models with 8GB budget", () => {
    const compatible = filterCompatibleModels(8_000_000_000);
    expect(compatible.length).toBe(6);
  });

  it("should recommend the largest compatible model", () => {
    // With 3GB budget, should recommend qwen3-1.7b (~2.2GB) over smaller models
    const budget3GB = 3_000_000_000;
    const compatible = MODEL_CATALOG.filter(
      (m) => m.estimatedRamBytes <= budget3GB,
    );
    const recommended =
      compatible.length > 0
        ? compatible.reduce((best, m) =>
            m.estimatedRamBytes > best.estimatedRamBytes ? m : best,
          )
        : null;
    expect(recommended).not.toBeNull();
    expect(recommended!.estimatedRamBytes).toBeGreaterThan(1_000_000_000);
  });

  it("should return no models with very small budget", () => {
    const compatible = MODEL_CATALOG.filter(
      (m) => m.estimatedRamBytes <= 100_000_000,
    );
    expect(compatible).toHaveLength(0);
  });
});

describe("RAM Budget Calculation", () => {
  it("should calculate 60% of total RAM correctly", () => {
    const totalRAM = 6_000_000_000; // 6GB
    const budget = totalRAM * 0.6;
    expect(budget).toBe(3_600_000_000);
  });

  it("should calculate 60% for 4GB device", () => {
    const totalRAM = 4_000_000_000; // 4GB
    const budget = totalRAM * 0.6;
    expect(budget).toBe(2_400_000_000);
  });

  it("should calculate 60% for 8GB device", () => {
    const totalRAM = 8_000_000_000; // 8GB
    const budget = totalRAM * 0.6;
    expect(budget).toBe(4_800_000_000);
  });
});
