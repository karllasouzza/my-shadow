import type {
    DeviceInfo,
    DeviceProfile,
    DeviceTier,
} from "@/shared/types/device";

const budgetProfile: DeviceProfile = {
  tier: "budget",
  label: "Budget Devices (3-5GB RAM)",
  ramRange: { min: 3, max: 5 },
  config: {
    n_ctx: 1024,
    n_batch: 64,
    n_threads: 4,
    n_gpu_layers: 0,
    use_mmap: true,
    use_mlock: false,
    cache_type_k: "q8_0",
    cache_type_v: "q8_0",
    n_predict: 512,
    n_parallel: 0,
    top_k: 40,
    top_p: 0.9,
    min_p: 0.05,
    dry_penalty_last_n: 32,
  },
  expectations: {
    ttftSeconds: { min: 3, max: 5 },
    tokensPerSecond: { min: 6, max: 8 },
    peakMemoryMB: 3500,
    crashRiskPercent: 35,
  },
  compatibleModels: {
    maxModelSizeGB: 3.5,
    recommendedQuantization: "Q4_K_M",
    warning: "Limited to 1K context. 7B models may require batch reduction.",
  },
};

const midRangeProfile: DeviceProfile = {
  tier: "midRange",
  label: "Mid-Range Devices (5-7GB RAM)",
  ramRange: { min: 5, max: 7 },
  config: {
    n_ctx: 2048,
    n_batch: 128,
    n_threads: 6,
    n_gpu_layers: 50,
    use_mmap: true,
    use_mlock: false,
    cache_type_k: "q8_0",
    cache_type_v: "q8_0",
    n_predict: 1024,
    n_parallel: 0,
    top_k: 40,
    top_p: 0.9,
    min_p: 0.05,
    dry_penalty_last_n: 48,
  },
  expectations: {
    ttftSeconds: { min: 1.5, max: 2.5 },
    tokensPerSecond: { min: 8, max: 10 },
    peakMemoryMB: 5200,
    crashRiskPercent: 12,
  },
  compatibleModels: {
    maxModelSizeGB: 5,
    recommendedQuantization: "Q5_K_M",
    warning: "2K context recommended. Larger models may throttle.",
  },
};

const premiumProfile: DeviceProfile = {
  tier: "premium",
  label: "Premium Devices (7GB+ RAM)",
  ramRange: { min: 7, max: 16 },
  config: {
    n_ctx: 4096,
    n_batch: 512,
    n_threads: 8,
    n_gpu_layers: 99,
    use_mmap: false,
    use_mlock: false,
    cache_type_k: "f16",
    cache_type_v: "f16",
    n_predict: 2048,
    n_parallel: 0,
    top_k: 40,
    top_p: 0.9,
    min_p: 0.05,
    dry_penalty_last_n: 64,
  },
  expectations: {
    ttftSeconds: { min: 0.7, max: 1.2 },
    tokensPerSecond: { min: 12, max: 15 },
    peakMemoryMB: 7500,
    crashRiskPercent: 3,
  },
  compatibleModels: {
    maxModelSizeGB: 13,
    recommendedQuantization: "Q6_K_M",
    warning: undefined,
  },
};

export const deviceProfiles = {
  budget: budgetProfile,
  midRange: midRangeProfile,
  premium: premiumProfile,
} as const;

export function classifyDeviceTier(availableRAM: number): DeviceTier {
  if (availableRAM < 5) return "budget";
  if (availableRAM < 7) return "midRange";
  return "premium";
}

export function selectDeviceProfile(deviceInfo: DeviceInfo): DeviceProfile {
  const tier = classifyDeviceTier(deviceInfo.availableRAM);

  const base = deviceProfiles[tier];

  const config = { ...base.config };
  config.n_threads = Math.min(config.n_threads, deviceInfo.cpuCores);

  if (tier === "midRange" && !deviceInfo.hasGPU) {
    config.n_gpu_layers = 0;
  }

  if (deviceInfo.gpuMemoryMB !== undefined && deviceInfo.gpuMemoryMB < 1000) {
    config.n_gpu_layers = Math.min(config.n_gpu_layers, 20);
  }

  return { ...base, config };
}
