/**
 * llama.rn v0.10.1+ natively supports cache_type_k and cache_type_v.
 *
 * Valid values: f16, f32, bf16, q8_0, q4_0, q4_1, iq4_nl, q5_0, q5_1
 *
 * This wrapper centralizes validation and passes params through to initLlama.
 * If a value outside this set is provided, llama.rn silently falls back to f16
 * and logs a warning — so we validate early to surface errors clearly.
 */

import type { CacheType } from "@/shared/types/device";

const LLAMA_VALID_CACHE_TYPES = [
  "f16",
  "f32",
  "bf16",
  "q8_0",
  "q4_0",
  "q4_1",
  "iq4_nl",
  "q5_0",
  "q5_1",
] as const;

type LlamaCacheType = (typeof LLAMA_VALID_CACHE_TYPES)[number];

export function isValidLlamaCacheType(value: string): value is LlamaCacheType {
  return (LLAMA_VALID_CACHE_TYPES as readonly string[]).includes(value);
}

export function resolveCacheType(
  requested: CacheType,
  fieldName: "cache_type_k" | "cache_type_v",
): string {
  if (!isValidLlamaCacheType(requested)) {
    console.warn(
      `[cache-quantization] ${fieldName}="${requested}" is not a valid llama.rn cache type. Falling back to "f16".`,
    );
    return "f16";
  }
  return requested;
}

export function buildCacheQuantizationParams(cacheTypeK: CacheType, cacheTypeV: CacheType): {
  cache_type_k: string;
  cache_type_v: string;
} {
  return {
    cache_type_k: resolveCacheType(cacheTypeK, "cache_type_k"),
    cache_type_v: resolveCacheType(cacheTypeV, "cache_type_v"),
  };
}
