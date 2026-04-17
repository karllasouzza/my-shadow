export type DeviceTier = "budget" | "midRange" | "premium";
export type CacheType = "f16" | "q8_0" | "q4_0";

export interface RuntimeConfig {
  model: string;
  n_ctx: number;
  n_batch: number;
  n_ubatch?: number;
  n_threads: number;
  n_threads_batch?: number;
  n_gpu_layers: number;
  use_mmap: boolean;
  use_mlock: boolean;
  cache_type_k: CacheType;
  cache_type_v: CacheType;
  flash_attn?: boolean;
  n_predict?: number;
  n_parallel?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  dry_penalty_last_n?: number;
}

export interface DeviceProfile {
  tier: DeviceTier;
  label: string;
  ramRange: { min: number; max: number };
  config: Partial<RuntimeConfig>;
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

export interface MemoryPressure {
  totalRAM: number;
  usedRAM: number;
  availableRAM: number;
  utilizationPercent: number;
  criticalLevel: boolean;
  canRunInference: boolean;
  recommendedMaxContext: number;
  recommendedBatch: number;
  sampledAt: number;
}
