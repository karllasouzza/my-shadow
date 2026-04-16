/**
 * Centralized constants for the AI runtime module.
 * These values are used across device detection, memory monitoring, and runtime configuration.
 * 
 * @module @/shared/ai/constants
 */

// ── Memory & OS Overhead ─────────────────────────────────────────────────────

/**
 * Conservative OS overhead reservation in GB.
 * This accounts for system processes, UI rendering, and other app overhead.
 * Adjust based on platform: iOS typically needs more reservation than Android.
 */
export const OS_OVERHEAD_GB = 0.8;

/**
 * Safe memory fraction for KV cache calculation.
 * We only use this percentage of available RAM to prevent OOM.
 */
export const SAFE_MEMORY_FRACTION = 0.5;

/**
 * Critical memory utilization threshold (percentage).
 * When exceeded, triggers warnings and potential model unloading.
 */
export const CRITICAL_UTILIZATION_THRESHOLD = 85;

/**
 * Minimum RAM required for inference in GB.
 * Below this threshold, local inference is not recommended.
 */
export const MINIMUM_RAM_FOR_INFERENCE_GB = 1.5;

// ── KV Cache Heuristics ──────────────────────────────────────────────────────

/**
 * Bytes per token for KV cache in budget mode (critical memory pressure).
 * Lower value = more aggressive quantization, potentially lower quality.
 */
export const KV_CACHE_BYTES_PER_TOKEN_BUDGET = 50;

/**
 * Bytes per token for KV cache in normal mode.
 * Standard allocation for typical memory conditions.
 */
export const KV_CACHE_BYTES_PER_TOKEN_OTHER = 70;

// ── GPU & VRAM ───────────────────────────────────────────────────────────────

/**
 * Heuristic: estimated GPU VRAM as fraction of total RAM (Android only).
 * iOS uses unified memory architecture and gets full RAM allocation.
 * 
 * ⚠️ Trade-off: This is a rough estimate. Actual VRAM varies by:
 * - GPU architecture (Adreno vs Mali)
 * - System memory pressure
 * - Display resolution and compositor needs
 */
export const GPU_VRAM_FRACTION = 0.3;

/**
 * Minimum GPU memory threshold in MB to consider GPU acceleration viable.
 */
export const MIN_GPU_VRAM_MB = 512;

// ── Runtime Configuration Bounds ─────────────────────────────────────────────

/**
 * Valid cache types for KV cache quantization.
 * 
 * Quality ranking (best to worst):
 * - f16: Full precision, best quality, highest memory usage
 * - q8_0: 8-bit quantization, ~50% memory savings, minimal quality loss (~2-5%)
 * - q4_0: 4-bit quantization, ~75% memory savings, noticeable quality loss (~8-15%)
 * 
 * Recommendation: Use q4_0 only for devices with ≤4GB RAM.
 */
export const VALID_CACHE_TYPES = ["f16", "q8_0", "q4_0"] as const;

/**
 * Context window bounds in tokens.
 */
export const CONTEXT_WINDOW_BOUNDS = {
  min: 128,
  max: 8192,
} as const;

/**
 * Batch size bounds.
 */
export const BATCH_SIZE_BOUNDS = {
  min: 32,
  max: 2048,
} as const;

/**
 * Thread count bounds.
 */
export const THREAD_COUNT_BOUNDS = {
  min: 1,
  max: 16,
} as const;

// ── Performance Tuning ───────────────────────────────────────────────────────

/**
 * Maximum batch size ceiling for mobile devices.
 * Prevents excessive memory allocation during prefill.
 */
export const MAX_MOBILE_BATCH_SIZE = 512;

/**
 * Minimum batch size floor to prevent over-reduction on extreme memory pressure.
 */
export const MIN_BATCH_SIZE = 64;

/**
 * CPU thread reservation: keep one core for UI thread.
 * Only applies to performance cores.
 */
export const UI_THREAD_RESERVATION = 1;

// ── Generation Defaults ──────────────────────────────────────────────────────

/**
 * Default stop sequences for chat completion.
 */
export const DEFAULT_STOP_SEQUENCES = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
] as const;

/**
 * Sampling defaults aligned with mobile constraints.
 */
export const SAMPLING_DEFAULTS = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40, // Reduces search space vs 50-100 default
  min_p: 0.05, // Aggressive filtering of improbable tokens
} as const;

// ── Timeout Configuration ────────────────────────────────────────────────────

/**
 * Timeout for async operations in milliseconds.
 * Prevents indefinite hangs during model loading or generation.
 */
export const ASYNC_OPERATION_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Timeout for warm-up operation specifically.
 * Warm-up should complete quickly; longer indicates issues.
 */
export const WARMUP_TIMEOUT_MS = 5000;
