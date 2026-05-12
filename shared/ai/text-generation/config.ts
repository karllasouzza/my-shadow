import { detectDevice } from "@/shared/device";
import type { ContextParams } from "llama.rn";
import { aiDebug } from "../log";
import type { ContextConfig, RamTier } from "./types";

export interface ConfigParams {
  readonly fileSizeBytes: number;
  readonly overrideNCtx?: number;
}

export function calculateRamTier(availableRamGB: number): RamTier {
  if (availableRamGB < 4) return "low";
  if (availableRamGB < 7) return "mid";
  return "high";
}

export function calculateThreads(cpuCores: number): number {
  return Math.max(4, cpuCores - 1);
}

export function calculateGpuLayers(hasGpu: boolean): number {
  return hasGpu ? 99 : 0;
}

export function calculateContextParams(
  tier: RamTier,
): Pick<ContextParams, "n_ctx" | "n_batch" | "n_ubatch"> {
  switch (tier) {
    case "low":
      return { n_ctx: 1024, n_batch: 128, n_ubatch: 64 };
    case "mid":
      return { n_ctx: 2048, n_batch: 256, n_ubatch: 128 };
    case "high":
      return { n_ctx: 4096, n_batch: 512, n_ubatch: 256 };
  }
}

export function calculateCacheType(tier: RamTier): {
  cache_type_k: ContextConfig["cache_type_k"];
  cache_type_v: ContextConfig["cache_type_v"];
} {
  const cacheType = tier === "low" ? "q4_0" : "q8_0";
  return { cache_type_k: cacheType, cache_type_v: cacheType };
}

export async function buildContextConfig(
  params: ConfigParams,
): Promise<ContextConfig> {
  const device = await detectDevice();
  const requiredGB = (params.fileSizeBytes * 1.5) / 1024 ** 3;

  aiDebug("CONFIG:device-check", `requiredGB=${requiredGB.toFixed(2)}`, {
    requiredGB,
    availableRAM: device.availableRAM,
  });

  if (requiredGB > device.availableRAM * 0.75) {
    throw new Error("LOAD:insufficient-memory");
  }

  const tier = calculateRamTier(device.availableRAM);
  const contextParams = calculateContextParams(tier);
  const cacheTypes = calculateCacheType(tier);

  const config: ContextConfig = {
    n_ctx: params.overrideNCtx ?? contextParams.n_ctx,
    n_batch: contextParams.n_batch,
    n_ubatch: contextParams.n_ubatch,
    use_mlock: device.platform === "iOS",
    use_mmap: true,
    n_threads: calculateThreads(device.cpuCores),
    n_gpu_layers: calculateGpuLayers(device.hasGPU),
    flash_attn: calculateGpuLayers(device.hasGPU) > 0,
    flash_attn_type: "auto",
    n_parallel: 1,
    no_extra_bufts: true,
    ...cacheTypes,
  };

  aiDebug("CONFIG:built", `tier=${tier}`, { tier, config });
  return config;
}
