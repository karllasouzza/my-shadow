import type {
    CacheType,
    DeviceInfo,
    RuntimeConfig,
} from "@/shared/device/types";
import { selectDeviceProfile } from "./device-profiles";

const VALID_CACHE_TYPES: CacheType[] = ["f16", "q8_0", "q4_0"];

export function validateCacheType(value: string): value is CacheType {
  return (VALID_CACHE_TYPES as string[]).includes(value);
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
  /** Reserve one core for the UI thread; use only performance cores. */
  generateThreadCount(deviceInfo: DeviceInfo): number {
    return Math.max(1, deviceInfo.performanceCores - 1);
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

  /** GPU layer count scaled by tier and available VRAM. */
  calculateGpuLayers(deviceInfo: DeviceInfo, tierDefault: number): number {
    if (!deviceInfo.hasGPU || deviceInfo.gpuBackend === null) return 0;
    if (deviceInfo.gpuMemoryMB !== undefined && deviceInfo.gpuMemoryMB < 1000) {
      return Math.min(tierDefault, 20);
    }
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
