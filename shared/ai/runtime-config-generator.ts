import type { CacheType, DeviceInfo, RuntimeConfig } from "@/shared/types/device";
import { selectDeviceProfile } from "./device-profiles";

const VALID_CACHE_TYPES: CacheType[] = ["f16", "q8_0", "q4_0"];

export function validateCacheType(value: string): value is CacheType {
  return (VALID_CACHE_TYPES as string[]).includes(value);
}

export function validateRuntimeConfig(config: Partial<RuntimeConfig>): string[] {
  const errors: string[] = [];

  if (config.n_ctx !== undefined && (config.n_ctx < 128 || config.n_ctx > 8192)) {
    errors.push(`n_ctx must be 128–8192, got ${config.n_ctx}`);
  }

  if (config.n_batch !== undefined && (config.n_batch < 32 || config.n_batch > 2048)) {
    errors.push(`n_batch must be 32–2048, got ${config.n_batch}`);
  }

  if (config.n_threads !== undefined && (config.n_threads < 1 || config.n_threads > 64)) {
    errors.push(`n_threads must be 1–64, got ${config.n_threads}`);
  }

  if (
    config.cache_type_k !== undefined &&
    !validateCacheType(config.cache_type_k)
  ) {
    errors.push(`cache_type_k must be f16|q8_0|q4_0, got ${config.cache_type_k}`);
  }

  if (
    config.cache_type_v !== undefined &&
    !validateCacheType(config.cache_type_v)
  ) {
    errors.push(`cache_type_v must be f16|q8_0|q4_0, got ${config.cache_type_v}`);
  }

  return errors;
}

export class RuntimeConfigGenerator {
  generateRuntimeConfig(
    deviceInfo: DeviceInfo,
    modelPath: string,
    overrides?: Partial<RuntimeConfig>,
  ): RuntimeConfig {
    const profile = selectDeviceProfile(deviceInfo);

    const base: RuntimeConfig = {
      ...profile.config,
      model: modelPath,
    };

    base.n_threads = Math.min(base.n_threads, deviceInfo.cpuCores);

    if (deviceInfo.gpuMemoryMB !== undefined && deviceInfo.gpuMemoryMB < 1000) {
      base.n_gpu_layers = Math.min(base.n_gpu_layers, 20);
    }

    const merged: RuntimeConfig = overrides
      ? { ...base, ...overrides, model: modelPath }
      : base;

    const errors = validateRuntimeConfig(merged);
    if (errors.length > 0) {
      console.warn("[RuntimeConfigGenerator] Invalid config fields:", errors);
    }

    if (merged.cache_type_k === "q4_0" || merged.cache_type_v === "q4_0") {
      // q4_0 trades quality for memory — acceptable only on extreme budget devices
    }

    return merged;
  }

  selectDeviceProfile(deviceInfo: DeviceInfo) {
    return selectDeviceProfile(deviceInfo);
  }
}
