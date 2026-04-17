export * from "./chat";
export * from "./constants";
export * from "./manager";
export * from "./model";
export * from "./model-loader";
export * from "./runtime";

export interface DeviceInfo {
  totalRAM: number;
  availableRAM: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuBackend: "Metal" | "Vulkan" | "OpenCL" | "none";
  platform: "iOS" | "Android";
  osVersion: string;
  deviceModel: string;
  detectedAt: number;
  gpuBrand?: string;
}

export interface GpuProfile {
  type: "budget" | "midRange" | "premium";
  backend: "Metal" | "Vulkan" | "OpenCL" | "none";
  enabled: boolean;
  flashAttention: boolean;
  vramFractionOfRAM: number;
}

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
  cache_type_k: "f16" | "q8_0" | "q4_0";
  cache_type_v: "f16" | "q8_0" | "q4_0";
  flash_attn?: boolean;
  n_predict?: number;
  n_parallel?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  dry_penalty_last_n?: number;
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

export interface ModelMetadata {
  filePath: string;
  fileSizeBytes: number;
  quantization: string;
  contextWindow: number;
  nParams?: number;
  sha256?: string;
}

export interface PreflightCheckResult {
  canLoad: boolean;
  requiredRAM: number;
  availableRAM: number;
  ramSufficient: boolean;
  integrityOk: boolean;
  integrityStatus: "verified" | "unverified" | "failed";
  reasons: string[];
}
