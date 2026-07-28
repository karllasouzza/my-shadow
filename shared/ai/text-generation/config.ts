import type { DeviceProfile } from "@/shared/device";
import type { RuntimeConfig } from "./types";

export function validateRuntimeConfig(
  config: unknown,
): config is RuntimeConfig {
  if (typeof config !== "object" || config === null) return false;

  const c = config as Record<string, unknown>;

  if (typeof c.model !== "string") return false;
  if (typeof c.n_ctx !== "number" || c.n_ctx <= 0) return false;
  if (typeof c.n_batch !== "number" || c.n_batch <= 0) return false;
  if (typeof c.n_threads !== "number" || c.n_threads <= 0) return false;
  if (typeof c.n_gpu_layers !== "number") return false;
  if (typeof c.use_mmap !== "boolean") return false;
  if (typeof c.use_mlock !== "boolean") return false;

  if (c.n_ubatch !== undefined && typeof c.n_ubatch !== "number") return false;
  if (c.n_threads_batch !== undefined && typeof c.n_threads_batch !== "number")
    return false;
  if (
    c.cache_type_k !== undefined &&
    !["f16", "q8_0", "q4_0"].includes(c.cache_type_k as string)
  )
    return false;
  if (
    c.cache_type_v !== undefined &&
    !["f16", "q8_0", "q4_0"].includes(c.cache_type_v as string)
  )
    return false;
  if (c.temperature !== undefined && typeof c.temperature !== "number")
    return false;
  if (c.top_p !== undefined && typeof c.top_p !== "number") return false;
  if (c.top_k !== undefined && typeof c.top_k !== "number") return false;

  return true;
}

export function buildConfig(
  device: DeviceProfile,
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
