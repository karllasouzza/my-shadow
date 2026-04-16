export type DeviceTier = "budget" | "midRange" | "premium";

export type CpuBrand =
  | "snapdragon"
  | "exynos"
  | "apple"
  | "helio"
  | "bionic"
  | "unknown";

export type GpuType = "adreno" | "mali" | "metal" | "vulkan" | "unknown";

export type CacheType = "f16" | "q8_0" | "q4_0";

export type GpuBackend = "metal" | "opencl" | "vulkan" | null;

export interface DeviceInfo {
  /** Total device RAM in gigabytes */
  totalRAM: number;
  /** Available RAM excluding OS and running apps */
  availableRAM: number;

  /** Physical CPU core count — used for n_threads config (max 8) */
  cpuCores: number;
  cpuBrand: CpuBrand;

  /**
   * High-frequency performance cores for n_threads calculation.
   * Heuristic: iOS 50% of cores, Android Snapdragon 37.5%, fallback 50%.
   * @example iPhone 15 Pro (6 cores) → 3 P-cores
   * @example Pixel 8 (8 cores, Tensor G3) → 3 P-cores
   */
  performanceCores: number;

  /** GPU presence and estimated VRAM */
  hasGPU: boolean;
  gpuMemoryMB?: number;
  gpuType?: GpuType;

  /**
   * GPU compute backend for flash_attn gating.
   * iOS → "metal", Android Adreno → "opencl", Android Mali → "vulkan", CPU-only → null
   */
  gpuBackend: GpuBackend;

  /** iOS or Android only (no web) */
  platform: "ios" | "android";
  osVersion: string;
  deviceModel: string;

  /** Detection metadata for debugging */
  detectedAt: number;
  detectionMethod: {
    ram: "react-native-device-info" | "native";
    gpu: "vulkan" | "egl" | "heuristic" | "metal" | "none";
    cpuCores: "os.cpus" | "native";
  };
}

export interface RuntimeConfig {
  /** Absolute path to the GGUF model file */
  model: string;

  /** Context window size in tokens (128–8192) */
  n_ctx: number;
  /** Prefill batch size (32–2048) */
  n_batch: number;
  /** Decode micro-batch size (optional) */
  n_ubatch?: number;

  /** CPU threads for inference (1–8, capped to actual core count) */
  n_threads: number;
  n_threads_batch?: number;

  /** GPU layers to offload (0 = CPU-only, 99 = full GPU) */
  n_gpu_layers: number;

  /** Memory-mapped file loading — critical for low-RAM devices */
  use_mmap: boolean;
  /** Lock model in RAM — keep false on mobile */
  use_mlock: boolean;

  /** KV cache precision for keys */
  cache_type_k: CacheType;
  /** KV cache precision for values */
  cache_type_v: CacheType;

  /** Adaptive generation budget (replaces static 4096). 512–2048 for mobile. */
  n_predict?: number;
  /** 0 = single decode sequence (mobile optimal, -30% RAM). */
  n_parallel?: number;

  temperature?: number;
  /** Sampling: 0.9 maintains output diversity */
  top_p?: number;
  /** Sampling: 40 reduces search space vs 50–100 default */
  top_k?: number;
  /** Sampling: 0.05 filters improbable tokens aggressively */
  min_p?: number;

  /** DRY repetition penalty window */
  dry_penalty?: number;
  dry_penalty_last_n?: number;

  jinja?: boolean;
  embedding?: boolean;
}

export interface DeviceProfile {
  tier: DeviceTier;
  label: string;

  /** RAM range in gigabytes (inclusive) */
  ramRange: { min: number; max: number };
  gpuMemoryRange?: { min: number; max: number };

  /** Pre-tuned baseline runtime configuration for this tier */
  config: Omit<RuntimeConfig, "model">;

  /** Expected performance characteristics */
  expectations: {
    ttftSeconds: { min: number; max: number };
    tokensPerSecond: { min: number; max: number };
    peakMemoryMB: number;
    crashRiskPercent: number;
  };

  compatibleModels: {
    maxModelSizeGB: number;
    recommendedQuantization: "Q4_K_M" | "Q5_K_M" | "Q6_K_M" | "Q8_0";
    warning?: string;
  };
}

export interface CacheMetadata {
  /** SHA256 hash of the GGUF model file */
  modelHash: string;
  modelSizeBytes: number;
  modelPath: string;

  runtimeVersion: string;
  /** SHA256 of the serialized RuntimeConfig */
  configHash: string;
  systemPromptHash: string;

  cachedAt: number;
  expiresAt: number;
  ttl: "runtime" | "persistent" | "permanent";

  loadedSuccessfully: boolean;
  lastError?: string;
}

export interface MemoryPressure {
  totalRAM: number;
  usedRAM: number;
  availableRAM: number;

  /** 0–100 */
  utilizationPercent: number;
  /** true when utilization > 85% */
  criticalLevel: boolean;

  /** Whether available memory supports an inference pass */
  canRunInference: boolean;
  /** Dynamically reduced safe context size given current RAM */
  recommendedMaxContext: number;
  /** Safe n_batch for current available RAM */
  recommendedBatch: number;

  sampledAt: number;
}
