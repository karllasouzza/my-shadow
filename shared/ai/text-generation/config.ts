import type { DeviceInfo } from "@/shared/device";
import type { ContextParams } from "llama.rn";

export function buildConfig(
  device: DeviceInfo,
  modelPath: string,
  overrides?: Partial<ContextParams>,
): ContextParams {
  const ram = device.availableRAM;
  const isLowEnd = ram < 4;
  const isMid = ram < 7;
  const isSmallModel = modelPath.includes("0.5b") || modelPath.includes("0.6b");

  return {
    model: modelPath,
    n_ctx: isLowEnd ? 1024 : isMid ? 2048 : 4096,
    // Reduced batch sizes for better mobile performance and lower latency
    n_batch: isSmallModel ? 64 : isLowEnd ? 128 : isMid ? 256 : 512,
    n_ubatch: isSmallModel ? 64 : isLowEnd ? 128 : isMid ? 256 : 512,
    n_threads: Math.max(2, device.cpuCores - 1),
    // Maximize GPU offload (99 = full offload on GPU) for all platforms with GPU
    n_gpu_layers: device.hasGPU ? 99 : 0,
    use_mmap: true,
    use_mlock: false,
    // KV cache quantization for memory efficiency (q8_0 = 8-bit quantization)
    cache_type_k: isLowEnd ? "q4_0" : "q8_0",
    cache_type_v: isLowEnd ? "q4_0" : "q8_0",
    ...overrides,
  };
}
