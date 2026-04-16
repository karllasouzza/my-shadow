# Phase 1 Design: Data Model & Device Profiles

**Phase**: Design & Contracts  
**Date**: 2026-04-15  
**Input**: research.md (Phase 0 complete)

---

## Overview

This document defines the data entities and device profiles that enable adaptive runtime configuration. It serves as the foundation for implementing dynamic configuration in `shared/ai/runtime.ts`.

---

## Core Entities

### 1. DeviceInfo (Detected at Runtime)

```typescript
/**
 * Device capabilities detected at app startup.
 * These are read-only system metrics used to classify device tier.
 */
export interface DeviceInfo {
  // RAM capacity (gigabytes)
  totalRAM: number;
  // Available RAM (excluding OS, already-running apps)
  availableRAM: number;

  // CPU capabilities
  cpuCores: number; // Physical core count (used for n_threads config)
  cpuBrand: "snapdragon" | "exynos" | "apple" | "helio" | "bionic" | "unknown";

  // GPU (if available)
  hasGPU: boolean;
  gpuMemoryMB?: number;
  gpuType?: "adreno" | "mali" | "metal" | "vulkan" | "unknown";

  // Platform specifics
  platform: "ios" | "android";
  osVersion: string; // e.g., "17.3.1"
  deviceModel: string; // e.g., "iPhone13,3"

  // Detection metadata
  detectedAt: number; // timestamp
  detectionMethod: {
    ram: "react-native-device-info" | "native";
    gpu: "vulkan" | "egl" | "heuristic" | "metal" | "none";
    cpuCores: "os.cpus" | "native";
  };
}
```

### 2. DeviceProfile (Derived Classification)

```typescript
/**
 * Categorization of device capabilities into three tiers.
 * Each tier has pre-tuned runtime configuration defaults.
 */
export type DeviceTier = "budget" | "midRange" | "premium";

export interface DeviceProfile {
  // Tier identifier
  tier: DeviceTier;
  label: string; // e.g., "Budget (< 5GB RAM)"

  // Hardware range (inclusive)
  ramRange: { min: number; max: number }; // GB
  gpuMemoryRange?: { min: number; max: number }; // MB

  // Recommended runtime configuration
  config: RuntimeConfig;

  // Expected performance (for user feedback)
  expectations: {
    ttftSeconds: { min: number; max: number };
    tokensPerSecond: { min: number; max: number };
    peakMemoryMB: number;
    crashRiskPercent: number; // 0-100
  };

  // Which models are compatible
  compatibleModels: {
    maxModelSizeGB: number;
    recommendedQuantization: "Q4_K_M" | "Q5_K_M" | "Q6_K_M" | "Q8_0";
    warning?: string; // e.g., "7B model limited to 3K context"
  };
}
```

### 3. RuntimeConfig (Adaptive Configuration)

```typescript
/**
 * Parameters passed to llama.rn context initialization.
 * These are derived from DeviceInfo and applied at model load time.
 */
export interface RuntimeConfig {
  // Model path (absolute or asset URI)
  model: string;

  // Context Management
  n_ctx: number; // Context size in tokens, 1024-4096
  n_batch: number; // Batch size for prefill, 32-512
  n_ubatch?: number; // Batch size for decode (optional)

  // Thread and Compute
  n_threads: number; // CPU threads, 1-8 (matching core count)
  n_threads_batch?: number; // Batch processing threads

  // GPU Offloading (if available)
  n_gpu_layers: number; // 0-99 (0 = CPU only, 99 = all weights on GPU)

  // Memory Optimization
  use_mmap: boolean; // Memory-mapped file loading (critical for low-RAM)
  use_mlock: boolean; // Lock model in RAM (false on mobile)

  // KV Cache Precision (from Phase 0 research)
  cache_type_k: "f16" | "q8_0" | "q4_0";
  cache_type_v: "f16" | "q8_0" | "q4_0";

  // Generation Control
  temperature?: number;
  top_p?: number;
  top_k?: number;

  // DRY penalty (reduces repetition)
  dry_penalty?: number;
  dry_penalty_last_n?: number;

  // Input/Output
  jinja?: boolean; // Support Jinja templates
  embedding?: boolean; // Generate embeddings (disable for inference)
}
```

### 4. CacheMetadata (Cache Invalidation)

```typescript
/**
 * Metadata for retrieved models and KV cache state.
 * Implements SHA256-based cache invalidation strategy.
 */
export interface CacheMetadata {
  // File integrity
  modelHash: string; // SHA256 of GGUF file
  modelSizeBytes: number;
  modelPath: string;

  // Configuration & version compatibility
  runtimeVersion: string; // Current llama.rn version
  configHash: string; // SHA256 of RuntimeConfig JSON
  systemPromptHash: string; // SHA256 of system prompt

  // Temporal tracking
  cachedAt: number; // timestamp
  expiresAt: number; // timestamp (ttl-based)
  ttl: "runtime" | "persistent" | "permanent";

  // Performance hint
  loadedSuccessfully: boolean;
  lastError?: string;
}
```

### 5. MemoryPressure (Runtime Monitoring)

```typescript
/**
 * Current device memory state, used for fallback/degradation.
 */
export interface MemoryPressure {
  // Absolute values (bytes)
  totalRAM: number;
  usedRAM: number;
  availableRAM: number;

  // Relative state (percentage)
  utilizationPercent: number; // 0-100
  criticalLevel: boolean; // true if > 85%

  // Computed metrics
  canRunInference: boolean; // Does available mem support n_batch + KV cache?
  recommendedMaxContext: number; // Dynamically reduced context size

  // Timestamp
  sampledAt: number;
}
```

---

## Device Profiles (Three-Tier Classification)

Based on Phase 0 research (Performance Baselines), three profile tiers:

### Budget Tier (< 5GB RAM)

```typescript
const budgetProfile: DeviceProfile = {
  tier: "budget",
  label: "Budget Devices (3-5GB RAM)",
  ramRange: { min: 3, max: 5 },

  config: {
    model: "", // Set at load time
    n_ctx: 1024, // Reduced context (tokens)
    n_batch: 64, // Conservative batch
    n_threads: Math.min(4, cpuCores), // Auto-capped
    n_gpu_layers: 0, // CPU-only (safer)
    use_mmap: true, // CRITICAL: Must enable for lazy loading
    use_mlock: false, // CRITICAL: Disable on mobile to avoid OOM
    cache_type_k: "q8_0", // Quantized K cache
    cache_type_v: "q8_0", // Quantized V cache
    dry_penalty_last_n: 32,
  },

  expectations: {
    ttftSeconds: { min: 3, max: 5 },
    tokensPerSecond: { min: 6, max: 8 },
    peakMemoryMB: 3500,
    crashRiskPercent: 35, // Higher risk tier
  },

  compatibleModels: {
    maxModelSizeGB: 3.5, // Recommend Q3_K_M / Q4_K_M (not Q5+)
    recommendedQuantization: "Q4_K_M",
    warning: "Limited to 1K context. 7B models may require batch reduction.",
  },
};
```

### Mid-Range Tier (5-7GB RAM)

```typescript
const midRangeProfile: DeviceProfile = {
  tier: "midRange",
  label: "Mid-Range Devices (5-7GB RAM)",
  ramRange: { min: 5, max: 7 },

  config: {
    model: "",
    n_ctx: 2048, // Standard context
    n_batch: 128, // Moderate batch
    n_threads: Math.min(6, cpuCores),
    n_gpu_layers: hasGPU ? 50 : 0, // Partial GPU offload if available
    use_mmap: true,
    use_mlock: false,
    cache_type_k: "q8_0",
    cache_type_v: "q8_0",
    dry_penalty_last_n: 48,
  },

  expectations: {
    ttftSeconds: { min: 1.5, max: 2.5 },
    tokensPerSecond: { min: 8, max: 10 },
    peakMemoryMB: 5200,
    crashRiskPercent: 12, // Moderate risk
  },

  compatibleModels: {
    maxModelSizeGB: 5,
    recommendedQuantization: "Q5_K_M",
    warning: "2K context recommended. Larger models may throttle.",
  },
};
```

### Premium Tier (7GB+ RAM)

```typescript
const premiumProfile: DeviceProfile = {
  tier: "premium",
  label: "Premium Devices (7GB+ RAM)",
  ramRange: { min: 7, max: 16 },

  config: {
    model: "",
    n_ctx: 4096, // Full context
    n_batch: 512, // Aggressive batch
    n_threads: Math.min(8, cpuCores),
    n_gpu_layers: 99, // Full GPU offload
    use_mmap: false, // Can afford to preload fully
    use_mlock: false, // Still false for safety
    cache_type_k: "f16", // Full precision K cache (no quantization)
    cache_type_v: "f16", // Full precision V cache
    dry_penalty_last_n: 64,
  },

  expectations: {
    ttftSeconds: { min: 0.7, max: 1.2 },
    tokensPerSecond: { min: 12, max: 15 },
    peakMemoryMB: 7500,
    crashRiskPercent: 3, // Minimal risk
  },

  compatibleModels: {
    maxModelSizeGB: 13,
    recommendedQuantization: "Q6_K_M",
    warning: "None. Supports full context and high-quality quantization.",
  },
};
```

---

## Classification Algorithm

```typescript
/**
 * Determines device tier based on detected RAM and GPU capabilities.
 * Applied at app startup via DeviceDetector service.
 */
export const classifyDeviceTier = (
  availableRAM: number,
  hasGPU: boolean,
): DeviceTier => {
  if (availableRAM < 5) return "budget";
  if (availableRAM < 7) return "midRange";
  return "premium";
};

export const selectDeviceProfile = (deviceInfo: DeviceInfo): DeviceProfile => {
  const tier = classifyDeviceTier(deviceInfo.availableRAM, deviceInfo.hasGPU);

  switch (tier) {
    case "budget":
      return { ...budgetProfile, config: { ...budgetProfile.config } };
    case "midRange":
      return { ...midRangeProfile, config: { ...midRangeProfile.config } };
    case "premium":
      return { ...premiumProfile, config: { ...premiumProfile.config } };
  }
};
```

---

## Memory Monitoring Algorithm

```typescript
/**
 * Runtime memory pressure evaluation.
 * Called periodically (every 30s or on memory warning).
 */
export const evaluateMemoryPressure = (): MemoryPressure => {
  const available = getAvailableRAMBytes();
  const total = getTotalRAMBytes();
  const used = total - available;
  const utilizationPercent = Math.round((used / total) * 100);

  // Compute safe context size given current memory
  const kvCachePerTokenByte = device.tier === "budget" ? 50 : 70; // Approx
  const safeContextTokens = Math.floor(
    (available * 0.5) / kvCachePerTokenByte, // Use 50% of available for safety
  );

  return {
    totalRAM: total,
    usedRAM: used,
    availableRAM: available,
    utilizationPercent,
    criticalLevel: utilizationPercent > 85,
    canRunInference: available > device.profile.config.n_batch * 100, // Approx
    recommendedMaxContext: Math.min(
      safeContextTokens,
      device.profile.config.n_ctx,
    ),
    sampledAt: Date.now(),
  };
};
```

---

## Configuration Generation Flow

```typescript
/**
 * End-to-end configuration generation (RuntimeConfigGenerator service).
 */
export const generateRuntimeConfig = async (
  deviceInfo: DeviceInfo,
  modelPath: string,
): Promise<RuntimeConfig> => {
  // 1. Classify device
  const profile = selectDeviceProfile(deviceInfo);

  // 2. Base config from profile
  const config: RuntimeConfig = {
    ...profile.config,
    model: modelPath,
  };

  // 3. Fine-tune based on actual CPU cores
  config.n_threads = Math.min(config.n_threads, deviceInfo.cpuCores);

  // 4. Fine-tune GPU layers based on detected VRAM
  if (deviceInfo.gpuMemoryMB && deviceInfo.gpuMemoryMB < 1000) {
    config.n_gpu_layers = Math.min(config.n_gpu_layers, 30); // Reduce offload
  }

  // 5. Check memory pressure
  const pressure = evaluateMemoryPressure();
  if (pressure.utilizationPercent > 70) {
    config.n_ctx = Math.min(config.n_ctx, pressure.recommendedMaxContext);
    config.n_batch = Math.max(32, Math.floor(config.n_batch / 2));
  }

  return config;
};
```

---

## Next Steps: Phase 1 Contracts

These data models are formalized in `contracts/runtime-config.schema.json` (JSON Schema).
See that file for validation rules and type constraints.

---

**Status**: ✅ Data model design complete. Ready for contract definition and quickstart guide.
