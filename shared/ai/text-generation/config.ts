import type { DeviceInfo } from "@/shared/device";
import type { ContextParams } from "llama.rn";

export function buildConfig(
  device: DeviceInfo,
  modelPath: string,
  fileSizeBytes: number,
  overrides?: Partial<ContextParams>,
): ContextParams {
  const ram = device.availableRAM;
  const isLowEnd = ram < 4;
  const isMid = ram < 7;
  const hasGPU = device.hasGPU;
  const enableFlashAttn = hasGPU && fileSizeBytes > 500_000_000;

  return {
    model: modelPath,
    n_ctx: isLowEnd ? 1024 : isMid ? 2048 : 4096,
    n_batch: isLowEnd ? 128 : isMid ? 256 : 512,
    n_ubatch: isLowEnd ? 64 : isMid ? 128 : 256,
    n_threads: Math.max(2, device.cpuCores - 1),
    n_gpu_layers: device.hasGPU ? 99 : 0,
    use_mmap: true,
    use_mlock: false,
    cache_type_k: isLowEnd ? "q4_0" : "q8_0",
    cache_type_v: isLowEnd ? "q4_0" : "q8_0",
    flash_attn: enableFlashAttn,
    flash_attn_type: enableFlashAttn ? "on" : "auto",
    ...overrides,
  };
}
