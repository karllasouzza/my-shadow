import type { DeviceProfile } from "@/shared/device";
import type { RuntimeConfig } from "./types";
import { ConfigBuilder } from "./config-builder";

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
  const builder = ConfigBuilder.fromDeviceProfile(device).withModel(modelPath);

  if (overrides) {
    builder.withOverrides(overrides);
  }

  return builder.build();
}
