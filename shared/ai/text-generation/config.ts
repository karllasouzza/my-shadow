import { detectDevice, type DeviceInfo } from "@/shared/device";
import type { ContextParams } from "llama.rn";
import { aiDebug } from "../log";

interface BuildConfigParams {
  modelPath: string;
  fileSizeBytes: number;
  overrides?: Partial<ContextParams>;
}

export async function buildConfig({
  modelPath,
  fileSizeBytes,
  overrides,
}: BuildConfigParams): Promise<ContextParams> {
  const device: DeviceInfo = await detectDevice();
  const requiredGB = (fileSizeBytes * 1.5) / 1024 ** 3;
  aiDebug("LOAD:device-check", `requiredGB=${requiredGB.toFixed(2)}`, {
    requiredGB,
    device,
  });

  const ram = device.availableRAM;
  const isLowEnd = ram < 4;
  const isMid = ram < 7;

  const enableFlashAttn = device.hasGPU;

  if (requiredGB > device.availableRAM * 0.75) {
    throw new Error("LOAD:insufficient-memory");
  }

  return {
    model: modelPath,
    n_ctx: isLowEnd ? 1024 : isMid ? 2048 : 4096,
    n_batch: isLowEnd ? 128 : isMid ? 256 : 512,
    n_ubatch: isLowEnd ? 64 : isMid ? 128 : 256,
    n_threads: Math.max(4, device.cpuCores - 1),
    n_gpu_layers: device.hasGPU ? 99 : 0,
    use_mmap: false,
    use_mlock: true,
    cache_type_k: isLowEnd ? "q4_0" : "q8_0",
    cache_type_v: isLowEnd ? "q4_0" : "q8_0",
    flash_attn: enableFlashAttn,
    flash_attn_type: enableFlashAttn ? "on" : "auto",
    ...overrides,
  };
}
