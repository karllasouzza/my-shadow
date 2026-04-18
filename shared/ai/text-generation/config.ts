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
    n_batch: isLowEnd ? 256 : isMid ? 512 : 1024,
    n_threads: device.cpuCores ?? 4,
    n_gpu_layers: device.platform === "iOS" ? 99 : device.hasGPU ? 10 : 0,
    use_mmap: true,
    use_mlock: false,
    temperature: 0.7,
    ...overrides,
  };
}
