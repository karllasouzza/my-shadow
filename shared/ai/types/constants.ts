export const DEVICE_TIERS = ["budget", "midRange", "premium"] as const;
export type DeviceTier = (typeof DEVICE_TIERS)[number];

export const GPU_BACKENDS = ["Metal", "Vulkan", "OpenCL", "none"] as const;
export type GpuBackend = (typeof GPU_BACKENDS)[number];

export const CACHE_TYPES = ["f16", "q8_0", "q4_0"] as const;
export type CacheType = (typeof CACHE_TYPES)[number];

export const OS_OVERHEAD_GB = {
  iOS: 1.5,
  Android: 2.0,
} as const;

export const MAX_THREADS = 8;
export const MIN_THREADS = 2;
