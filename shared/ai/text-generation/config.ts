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
    n_ctx: isLowEnd ? 1024 : isMid ? 2048 : 4096,
    n_batch: isLowEnd ? 64 : 512,
    n_threads: device.cpuCores,
    n_gpu_layers: device.platform === "iOS" ? 99 : 0,
    use_mmap: true,
    use_mlock: false,
    cache_type_k: "q4_0",
    cache_type_v: "q4_0",
    n_predict: 2048,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    min_p: 0.05,
    ...overrides,
  };
}
