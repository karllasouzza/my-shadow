import type { DeviceInfo } from "@/shared/device";
import type { RuntimeConfig } from "./types";

export function buildConfig(
  device: DeviceInfo,
  modelPath: string,
  overrides?: Partial<RuntimeConfig>,
): RuntimeConfig {
  const ram = device.availableRAM;

  const isLowEnd = ram < 4;
  const isMid = ram < 7;

  return {
    model: modelPath,
    n_ctx: isLowEnd ? 2048 : 4096,
    // Reduced batch sizes for better mobile performance and lower latency
    n_batch: isLowEnd ? 128 : isMid ? 256 : 512,
    n_ubatch: isLowEnd ? 128 : isMid ? 256 : 512,
    n_threads: device.cpuCores ?? 4,
    // Maximize GPU offload (99 = full offload on GPU) for all platforms with GPU
    n_gpu_layers: device.hasGPU ? 99 : 0,
    use_mmap: true,
    use_mlock: false,
    // KV cache quantization for memory efficiency (q8_0 = 8-bit quantization)
    cache_type_k: "q8_0",
    cache_type_v: "q8_0",
    temperature: 0.7,
    ...overrides,
  };
}
