import { GpuBackend } from "../ai/utils/constants";
import type { DeviceTier, RuntimeConfig } from "./types";

interface CpuProfile {
  brand: string;
  performanceCoreRatio: number;
}

interface GpuProfile {
  type: string;
  backend: GpuBackend;
  vramFraction: number;
}

const CPU_PROFILES: Record<string, CpuProfile> = {
  apple: { brand: "bionic", performanceCoreRatio: 0.5 },
  snapdragon: { brand: "snapdragon", performanceCoreRatio: 0.375 },
  exynos: { brand: "exynos", performanceCoreRatio: 0.5 },
  helio: { brand: "helio", performanceCoreRatio: 0.5 },
  mediatek: { brand: "helio", performanceCoreRatio: 0.5 },
};

const GPU_PROFILES: Record<string, GpuProfile> = {
  ios: { type: "metal", backend: "Metal", vramFraction: 1.0 },
  adreno: { type: "adreno", backend: "OpenCL", vramFraction: 0.3 },
  mali: { type: "mali", backend: "Vulkan", vramFraction: 0.25 },
};

const TIER_PROFILES: Record<
  DeviceTier,
  { maxRAM: number; config: Partial<RuntimeConfig> }
> = {
  budget: {
    maxRAM: 4,
    config: {
      n_ctx: 512,
      n_batch: 128,
      n_threads: 2,
      n_gpu_layers: 0,
      use_mmap: true,
      use_mlock: false,
      cache_type_k: "q4_0",
      cache_type_v: "q4_0",
      n_predict: 512,
    },
  },
  midRange: {
    maxRAM: 8,
    config: {
      n_ctx: 2048,
      n_batch: 512,
      n_threads: 4,
      n_gpu_layers: 12,
      use_mmap: true,
      use_mlock: false,
      cache_type_k: "q8_0",
      cache_type_v: "q8_0",
      n_predict: 1024,
    },
  },
  premium: {
    maxRAM: Infinity,
    config: {
      n_ctx: 4096,
      n_batch: 1024,
      n_threads: 6,
      n_gpu_layers: 99,
      use_mmap: false,
      use_mlock: true,
      cache_type_k: "f16",
      cache_type_v: "f16",
      n_predict: 2048,
    },
  },
};

export function getTierByRAM(ramGB: number): DeviceTier {
  if (ramGB <= TIER_PROFILES.budget.maxRAM) return "budget";
  if (ramGB <= TIER_PROFILES.midRange.maxRAM) return "midRange";
  return "premium";
}

export function getTierConfig(tier: DeviceTier): Partial<RuntimeConfig> {
  return TIER_PROFILES[tier].config;
}

export function resolveCpuProfile(brand: string): CpuProfile {
  const key = Object.keys(CPU_PROFILES).find((k) =>
    brand.toLowerCase().includes(k),
  );
  return key
    ? CPU_PROFILES[key]
    : { brand: "unknown", performanceCoreRatio: 0.5 };
}

export function resolveGpuProfile(
  platform: "iOS" | "Android",
  brand?: string,
): GpuProfile {
  if (platform === "iOS") return GPU_PROFILES.ios;

  const key = Object.keys(GPU_PROFILES).find((k) =>
    brand?.toLowerCase().includes(k),
  );
  return key
    ? GPU_PROFILES[key]
    : { type: "unknown", backend: "none", vramFraction: 0.3 };
}
