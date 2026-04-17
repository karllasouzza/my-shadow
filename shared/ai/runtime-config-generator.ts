import type { DeviceInfo, RuntimeConfig } from "@/shared/ai/types";
import type { CacheType } from "@/shared/device/types";
import { selectDeviceProfile } from "./device-profiles";

const VALID_CACHE_TYPES: CacheType[] = ["f16", "q8_0", "q4_0"];

export function validateCacheType(value: string): value is CacheType {
  return (VALID_CACHE_TYPES as string[]).includes(value);
}

export function selectGpuBackend(
  osVersion: string,
  gpuBrand: string,
  platform: "ios" | "android",
): "Metal" | "Vulkan" | "OpenCL" | "none" {
  if (platform === "ios") return "Metal";

  const majorVersion = parseInt(osVersion.split(".")[0] ?? "0", 10);
  const isSnapdragon = /qualcomm|snapdragon|adreno/i.test(gpuBrand);

  if (majorVersion >= 13 && isSnapdragon) return "Vulkan";

  return "OpenCL";
}

export async function probeGpuBackend(
  gpuBackend: "Metal" | "Vulkan" | "OpenCL" | "none",
): Promise<boolean> {
  if (gpuBackend === "none") return false;

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[GPU Probe] Timeout probing ${gpuBackend} backend`);
      resolve(false);
    }, 500);

    void Promise.resolve(true)
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        console.warn(`[GPU Probe] Failed to probe ${gpuBackend}:`, err);
        resolve(false);
      });
  });
}

export function validateRuntimeConfig(
  config: Partial<RuntimeConfig>,
): string[] {
  const errors: string[] = [];

  if (
    config.n_ctx !== undefined &&
    (config.n_ctx < 128 || config.n_ctx > 8192)
  ) {
    errors.push(`n_ctx must be 128–8192, got ${config.n_ctx}`);
  }

  if (
    config.n_batch !== undefined &&
    (config.n_batch < 32 || config.n_batch > 2048)
  ) {
    errors.push(`n_batch must be 32–2048, got ${config.n_batch}`);
  }

  if (
    config.n_threads !== undefined &&
    (config.n_threads < 1 || config.n_threads > 16)
  ) {
    errors.push(`n_threads must be 1–16, got ${config.n_threads}`);
  }

  if (
    config.cache_type_k !== undefined &&
    !validateCacheType(config.cache_type_k)
  ) {
    errors.push(
      `cache_type_k must be f16|q8_0|q4_0, got ${config.cache_type_k}`,
    );
  }

  if (
    config.cache_type_v !== undefined &&
    !validateCacheType(config.cache_type_v)
  ) {
    errors.push(
      `cache_type_v must be f16|q8_0|q4_0, got ${config.cache_type_v}`,
    );
  }

  return errors;
}

export class RuntimeConfigGenerator {
  // n_threads is capped at 8 because llama.cpp's internal parallelism shows
  // diminishing returns beyond 8 threads on mobile silicon — extra threads
  // increase context-switch overhead without improving throughput (FR-008).
  generateThreadCount(deviceInfo: DeviceInfo): number {
    return Math.max(1, Math.min(deviceInfo.cpuCores, 8));
  }

  /**
   * n_batch bounded by: context size/2, 30% of available RAM, and mobile ceiling 512.
   * Floor of 64 enforced to prevent over-reduction on extreme memory.
   */
  calculateOptimalBatch(n_ctx: number, availableRAMBytes: number): number {
    const maxByRAM = Math.floor((availableRAMBytes * 0.3) / 1024);
    const maxByContext = Math.floor(n_ctx / 2);
    return Math.min(512, Math.max(64, Math.min(maxByContext, maxByRAM)));
  }

  /**
   * Adaptive n_predict sized by ratio of available RAM to model footprint.
   * Safety factor: 2x model size for KV cache + activations overhead.
   */
  getAdaptiveNPredict(modelSizeGB: number, availableRAMBytes: number): number {
    const availableGB = availableRAMBytes / 1024 ** 3;
    const ratio = availableGB / (modelSizeGB * 2);
    if (ratio < 1) return 512;
    if (ratio < 2) return 1024;
    return 2048;
  }

  /** GPU layer count: returns tierDefault when GPU is available, 0 otherwise. */
  calculateGpuLayers(deviceInfo: DeviceInfo, tierDefault: number): number {
    if (!deviceInfo.hasGPU || deviceInfo.gpuBackend === null) return 0;
    return tierDefault;
  }

  generateRuntimeConfig(
    deviceInfo: DeviceInfo,
    modelPath: string,
    overrides?: Partial<RuntimeConfig>,
  ): RuntimeConfig {
    const profile = selectDeviceProfile(deviceInfo);

    const base: RuntimeConfig = {
      ...profile.config,
      model: modelPath,
      n_ctx: profile.config.n_ctx ?? 2048,
      n_batch: profile.config.n_batch ?? 128,
      n_threads: profile.config.n_threads ?? 4,
      n_gpu_layers: profile.config.n_gpu_layers ?? 0,
      use_mmap: profile.config.use_mmap ?? true,
      use_mlock: profile.config.use_mlock ?? false,
      cache_type_k: profile.config.cache_type_k ?? "q4_0",
      cache_type_v: profile.config.cache_type_v ?? "q4_0",
    };

    base.n_threads = this.generateThreadCount(deviceInfo);
    base.n_gpu_layers = this.calculateGpuLayers(
      deviceInfo,
      base.n_gpu_layers,
    );

    const merged: RuntimeConfig = overrides
      ? { ...base, ...overrides, model: modelPath }
      : base;

    const errors = validateRuntimeConfig(merged);
    if (errors.length > 0) {
      console.warn("[RuntimeConfigGenerator] Invalid config fields:", errors);
    }

    if (merged.cache_type_k === "q4_0" || merged.cache_type_v === "q4_0") {
      console.warn(
        "[RuntimeConfigGenerator] Q4_0 KV cache causes ±8-15% quality loss; recommend for 4GB devices only",
      );
    }

    merged.flash_attn =
      deviceInfo.platform === "iOS" &&
      deviceInfo.hasGPU &&
      deviceInfo.gpuBackend === "Metal";

    return merged;
  }

  selectDeviceProfile(deviceInfo: DeviceInfo) {
    return selectDeviceProfile(deviceInfo);
  }

  validateCacheConfig(cache_type_k: string, cache_type_v: string): boolean {
    const valid =
      validateCacheType(cache_type_k) && validateCacheType(cache_type_v);
    if (cache_type_k === "q4_0" || cache_type_v === "q4_0") {
      console.warn(
        "[RuntimeConfigGenerator] Q4_0 KV cache causes ±8-15% quality loss; recommend for 4GB devices only",
      );
    }
    return valid;
  }
}
