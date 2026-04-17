import { getTierByRAM, getTierConfig } from "./hardware-database";
import { DeviceInfo, RuntimeConfig } from "./types";

export function buildRuntimeConfig(
  deviceInfo: DeviceInfo,
  modelPath: string,
  overrides?: Partial<RuntimeConfig>,
): RuntimeConfig {
  const tier = getTierByRAM(deviceInfo.totalRAM);
  const baseConfig = getTierConfig(tier);

  const threads = Math.min(deviceInfo.cpuCores, 8);
  const adjustedBatch = Math.min(
    baseConfig.n_batch || 512,
    Math.floor(deviceInfo.availableRAM * 128),
  );

  return {
    model: modelPath,
    n_ctx: baseConfig.n_ctx || 2048,
    n_batch: adjustedBatch,
    n_threads: threads,
    n_threads_batch: threads,
    n_gpu_layers: deviceInfo.hasGPU ? baseConfig.n_gpu_layers || 0 : 0,
    use_mmap: baseConfig.use_mmap ?? true,
    use_mlock: baseConfig.use_mlock ?? false,
    cache_type_k: baseConfig.cache_type_k || "q4_0",
    cache_type_v: baseConfig.cache_type_v || "q4_0",
    n_predict: baseConfig.n_predict,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    min_p: 0.05,
    ...overrides,
  };
}
