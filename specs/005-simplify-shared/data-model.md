# Data Model: Device Detection & AI Runtime Configuration

**Phase**: 1 - Design  
**Status**: Complete  
**Extracted From**: Feature Specification (005-simplify-shared)

## Core Entities

### 1. DeviceInfo

**Purpose**: Represents detected device capabilities (hardware and software profile).

**Fields**:

```typescript
interface DeviceInfo {
  // Hardware
  totalRAM: number; // Total device RAM in GB
  availableRAM: number; // Available RAM after OS overhead (GB)
  cpuCores: number; // Actual CPU core count (no brand-specific adjustment)
  hasGPU: boolean; // GPU hardware available
  gpuBackend: "Metal" | "Vulkan" | "OpenCL" | "none"; // GPU backend selection

  // Software
  platform: "iOS" | "Android"; // Native platform
  osVersion: string; // OS version (e.g., "13.0", "17.1")
  deviceModel: string; // Device model for logging (e.g., "iPhone15,1")

  // Metadata
  detectedAt: number; // Timestamp of detection (ISO 8601 or Unix ms)
  gpuBrand?: string; // GPU vendor (Adreno, Metal, etc.) - debug only
}
```

**Validation Rules**:

```
- totalRAM > 0
- 0 ≤ availableRAM ≤ totalRAM
- cpuCores > 0
- If hasGPU true, then gpuBackend !== "none"
- If hasGPU false, then gpuBackend === "none"
- platform is iOS or Android
- osVersion matches semantic versioning
- detectedAt is valid timestamp
```

**Computed Properties**:

- `memoryPressure = 1 - (availableRAM / totalRAM)` (0 to 1, where 1 = full)
- `isLowMemoryDevice = availableRAM < 1.0` (GB)
- `isMidRangeDevice = 4 ≤ availableRAM < 6` (GB after OS overhead)
- `isPremiumDevice = availableRAM ≥ 6` (GB)

---

### 2. GpuProfile

**Purpose**: Encodes GPU acceleration configuration for a specific device tier.

**Fields**:

```typescript
interface GpuProfile {
  type: "budget" | "midRange" | "premium"; // Device tier
  backend: "Metal" | "Vulkan" | "OpenCL" | "none";
  enabled: boolean; // Whether GPU should be used
  flashAttention: boolean; // Enable Flash Attention optimization
  vramFractionOfRAM: number; // Fraction of available RAM to allocate to GPU (0.3-0.8)
}
```

**Tier Definitions**:

| Tier     | Available RAM | GPU Backend                                   | Flash Attention | VRAM Fraction |
| -------- | ------------- | --------------------------------------------- | --------------- | ------------- |
| budget   | < 5 GB        | OpenCL (Android) / Metal (iOS)                | false           | 0.3           |
| midRange | 5-7 GB        | Vulkan (Android 13+ Snapdragon) / Metal (iOS) | false           | 0.5           |
| premium  | ≥ 7 GB        | Vulkan (Android 13+ Snapdragon) / Metal (iOS) | true (iOS only) | 0.6           |

**Validation**:

- If `type === "budget"` and platform is Android, `backend` must be OpenCL or fallback to CPU
- If platform is iOS, `backend` must be Metal or none
- `flashAttention = true` only if platform is iOS AND backend is Metal
- `vramFractionOfRAM` in range [0.2, 0.8]

---

### 3. RuntimeConfig

**Purpose**: Complete llama.cpp configuration derived from device profile and model metadata.

**Fields**:

```typescript
interface RuntimeConfig {
  // Model & Context
  modelPath: string; // Path to GGUF model file
  n_ctx: number; // Context window size (tokens)
  n_batch: number; // Batch size for inference

  // GPU & Threading
  n_gpu_layers: number; // Layers to offload to GPU (0 = CPU only)
  n_threads: number; // CPU threads (capped at 8)

  // GPU-specific
  gpu_device: number; // GPU device ID (default 0)
  cache_type_k: "f16" | "q8_0" | "q4_0"; // KV cache quantization type
  cache_type_v: "f16" | "q8_0" | "q4_0";

  // Flash Attention
  flash_attn: boolean; // true when deviceInfo.platform === 'ios' && deviceInfo.hasGPU
  flash_attn_type: "on" | "auto" | "off"; // "on" for iOS, "off" for Android. Example: deviceInfo.platform === 'ios' ? "on" : "off"

  // Memory
  use_mlock: boolean; // Lock model in RAM (prevent swapping)
  use_mmap: boolean; // Memory-map model file

  // Inference
  temperature: number; // Sampling temperature (default 0.7)
  top_p: number; // Nucleus sampling threshold (default 0.95)

  // Implementation example (RuntimeConfig synthesis):
  // runtimeConfig.flash_attn = deviceInfo.platform === 'ios' && deviceInfo.hasGPU
  // runtimeConfig.flash_attn_type = deviceInfo.platform === 'ios' ? 'on' : 'off'
  // Logging
  verbose: boolean; // Enable verbose logging
}
```

**Validation**:

```
- n_ctx > 0 and n_ctx ≤ max_ctx_from_model
- n_batch > 0 and n_batch ≤ n_ctx
- 0 ≤ n_gpu_layers ≤ total_model_layers
- 1 ≤ n_threads ≤ 8
- 0 ≤ temperature ≤ 2.0
- 0.0 < top_p ≤ 1.0
- flash_attn = false if not iOS Metal
```

**State Transitions**:

- Initial state: All defaults from device profile
- Transition to degraded: If runtime GPU probe fails, set `n_gpu_layers = 0`, update `cache_type_*` to `q8_0`
- Transition to emergency: If available memory drops during inference, halt and fallback to cached result

---

### 4. MemoryPressure

**Purpose**: Current memory utilization metrics for runtime decision-making.

**Fields**:

```typescript
interface MemoryPressure {
  availableRAM: number; // Current available RAM (GB)
  usedRAM: number; // Current used RAM (GB)
  totalRAM: number; // Total device RAM (GB)

  // Computed
  pressurePercentage: number; // (usedRAM / totalRAM) * 100
  criticalLevel: boolean; // pressurePercentage > 85%
  evaluatedAt: number; // Timestamp of evaluation
}
```

**Validation**:

```
- 0 ≤ usedRAM ≤ totalRAM
- pressurePercentage = (usedRAM / totalRAM) * 100
- criticalLevel = pressurePercentage > 85
```

**Threshold Semantics**:

- **Normal** (< 70%): Safe for model loading and generation
- **Elevated** (70-85%): Monitor; may reject large models
- **Critical** (> 85%): Trigger warnings; fallback to CPU only

---

### 5. ModelMetadata

**Purpose**: Model information for accurate memory budgeting and capability matching.

**Fields**:

```typescript
interface ModelMetadata {
  fileSizeBytes: number; // GGUF file size in bytes
  modelSizeBytes: number; // Unquantized model size (estimated from weights)
  quantizationType:
    | "f32"
    | "f16"
    | "q8_0"
    | "q4_0"
    | "iq3_xxs"
    | "iq3_s"
    | "iq2_k";
  contextWindow: number; // Suggested context window (tokens)
  attentionHeads: number; // Number of attention heads
  headDimension: number; // Dimension per head
  numLayers: number; // Number of transformer layers
  kvCacheElementSize: number; // Bytes per cache element (2 for f16, 1 for q8_0)

  // Computed
  sha256Hash?: string; // SHA256 hash for integrity verification
  requiredRAM: number; // Calculated required RAM (GB)

  // Metadata
  loadedAt: number; // Timestamp when metadata was loaded
}
```

**Computed Memory Budget** (using metadata):

```
// Note: KV cache is stored per layer (each transformer layer caches keys and values).
// Let hidden_size = attentionHeads × headDimension
// KV Cache Size (bytes) = numLayers × 2 × hidden_size × contextWindow × kvCacheElementSize
// Working Memory (bytes) = 0.15 × modelSizeBytes
// Overhead (bytes) = 0.5 × 1024^3
// Total Required (bytes) = modelSizeBytes + KV Cache Size + Working Memory + Overhead
// requiredRAM (GiB) = Total Required / (1024^3)

KV Cache Size = numLayers × 2 × (attentionHeads × headDimension) × contextWindow × kvCacheElementSize (bytes)
Working Memory = 0.15 × modelSizeBytes
Total Required = modelSizeBytes + KV Cache Size + Working Memory + Overhead (0.5 GB)
requiredRAM = Total Required / (1024^3)  // Convert to GiB
```

**Fallback Formula** (if metadata unavailable):

```
// Conservative fallback: assume 32 layers, hidden_size 4096, f16 elements (2 bytes)
// KV fallback bytes = 2 × numLayers(32) × hidden_size(4096) × context(assume 1024) × 2
// Convert to GiB and add working + overhead
requiredRAM = modelSizeBytes + (2 * 32 * 4096 * 1024 * 2) / (1024^3) + (0.15 * modelSizeBytes) + 0.5
```

## Derivation and Units

- hidden_size = attentionHeads × headDimension (units: elements)
- KV cache per token per layer (elements) = 2 × hidden_size (keys + values)
- KV cache bytes = numLayers × 2 × hidden_size × contextWindow × kvCacheElementSize (bytes)
- Working memory (bytes) = 0.15 × modelSizeBytes
- Overhead (bytes) = 0.5 × 1024^3
- All byte-to-GiB conversions use GiB (divide by 1024^3) for consistency with OS memory reporting.

## Worked Examples / Test Vectors

1. 7B model (typical LLaMA-like assumptions)

- Assumptions:
  - modelFileSize (quantized) = 4.0 GiB (4 \* 1024^3 bytes)
  - modelSizeBytes = 4.0 GiB in bytes
  - numLayers = 32
  - attentionHeads = 32
  - headDimension = 128 (hidden_size = 32 \* 128 = 4096)
  - kvCacheElementSize = 2 bytes (f16)
  - contextWindow = 2048

- KV Cache bytes = 32 × 2 × 4096 × 2048 × 2 = 1,073,741,824 bytes (≈ 1.0 GiB)
- Working memory = 0.15 × 4.0 GiB = 0.6 GiB
- Overhead = 0.5 GiB
- Total required ≈ 4.0 + 1.0 + 0.6 + 0.5 = 6.1 GiB

Expected test vector: calculateMemoryBudget(...) returns { required: ~6.1, available: <computed>, sufficient: boolean }

2. 13B illustrative example (assumptions, adjust per model metadata)

- Assumptions:
  - modelFileSize (quantized) = 8.0 GiB
  - numLayers = 40
  - attentionHeads = 64
  - headDimension = 128 (hidden_size = 8192)
  - kvCacheElementSize = 2 bytes (f16)
  - contextWindow = 2048

- KV Cache bytes = 40 × 2 × 8192 × 2048 × 2 = 2,684,354,560 bytes (≈ 2.5 GiB)
- Working memory = 0.15 × 8.0 GiB = 1.2 GiB
- Overhead = 0.5 GiB
- Total required ≈ 8.0 + 2.5 + 1.2 + 0.5 = 12.2 GiB

Expected test vector: calculateMemoryBudget(...) returns { required: ~12.2, available: <computed>, sufficient: boolean }

// Note: Test vectors above should be added to unit tests (e.g., `tests/unit/model-loader.test.ts`) as deterministic numeric checks when metadata is mocked. When metadata is unavailable, verify the fallback produces conservative (larger) estimates.

---

## Relationships

### DeviceInfo → GpuProfile

```
┌─────────────┐
│ DeviceInfo  │
│ hasGPU      │
│ gpuBackend  │
│ availableRAM│
└──────┬──────┘
       │ determines tier (budget/midRange/premium)
       │ + backend matching
       ▼
   ┌─────────────┐
   │ GpuProfile  │
   │ type        │
   │ backend     │
   │ flashAtten  │
   └─────────────┘
```

### DeviceInfo + ModelMetadata → RuntimeConfig

```
┌─────────────┐                ┌─────────────────┐
│ DeviceInfo  │                │ ModelMetadata   │
│ cpuCores    │                │ contextWindow   │
│ gpuBrand    │                │ quantizationType│
│ availableRAM├────────────────┤ requiredRAM     │
└─────────────┘                └─────────────────┘
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
          ┌──────────────────────┐
          │ RuntimeConfig        │
          │ n_ctx                │
          │ n_gpu_layers         │
          │ cache_type_k/v       │
          │ flash_attn           │
          └──────────────────────┘
```

### MemoryMonitor → MemoryPressure → RuntimeConfig Adjustment

```
Periodic Evaluation (every 100-500ms)
         │
         ▼
  ┌──────────────────┐
  │ MemoryPressure   │
  │ pressurePerc     │
  └────────┬─────────┘
           │
           ├─ If critical (>85%)
           │  └─> Trigger warning + potential fallback
           │
           └─ If elevated (70-85%)
              └─> Flag for decision-making
```

---

## State Machines

### Device Detection Lifecycle

```
Startup
  │
  ├─> Native API calls (totalRAM, availableRAM, cpuCores, GPU detection)
  │
  ├─> Platform-specific detection (iOS: Metal, Android: Vulkan/OpenCL decision)
  │
  ├─ IF Android 13+ Snapdragon
  │  └─> GPU probe attempt (Vulkan with timeout)
  │     ├─ Success → hasGPU: true, gpuBackend: Vulkan
  │     └─ Failure → hasGPU: false, gpuBackend: none
  │
  ├─ IF Android < 13 or non-Snapdragon
  │  └─> Set gpuBackend: OpenCL (safe default)
  │
  ├─ IF iOS
  │  └─> Set gpuBackend: Metal
  │
  └─> Return DeviceInfo
```

### Model Loading Lifecycle

```
Model Load Request
  │
  ├─> Evaluate memory pressure
  │   └─ IF critical → reject
  │
  ├─> Load ModelMetadata (context, quantization, cache params)
  │   └─ IF unavailable → use fallback formula
  │
  ├─> Calculate requiredRAM
  │   └─ IF required > available → reject with message
  │
  ├─> Calculate RuntimeConfig
  │   ├─ Select cache quantization tier (f16 premium, q8_0 midRange, q4_0 budget)
  │   └─ Set n_gpu_layers based on device profile
  │
  ├─> Download model + SHA256 verification
  │   └─ IF hash mismatch → reject + retry
  │
  ├─> Initialize AIRuntime with RuntimeConfig
  │   ├─ IF GPU init fails → fallback to CPU (n_gpu_layers = 0)
  │   └─ Monitor memory during initialization
  │
  └─> Model ready for inference
```

---

## Type Exports (TypeScript)

All entities exported from `shared/ai/types/index.ts`:

```typescript
export type {
  DeviceInfo,
  GpuProfile,
  RuntimeConfig,
  MemoryPressure,
  ModelMetadata,
  DetectionResult,
  // ... other types
};

export const DEVICE_TIERS = {
  BUDGET: "budget",
  MID_RANGE: "midRange",
  PREMIUM: "premium",
} as const;

export const GPU_BACKENDS = {
  METAL: "Metal",
  VULKAN: "Vulkan",
  OPENCL: "OpenCL",
  NONE: "none",
} as const;

export const CACHE_TYPES = {
  F16: "f16",
  Q8_0: "q8_0",
  Q4_0: "q4_0",
} as const;
```

---

## Validation & Testing Hooks

### Unit Test Entities

- **DeviceInfo Builder**: Mock device profiles (low-memory Android, premium iOS, etc.)
- **GpuProfile Matcher**: Verify tier selection based on RAM
- **RuntimeConfig Generator**: Test config synthesis from DeviceInfo + ModelMetadata
- **Memory Budget Calculator**: Test formula accuracy against known models

### Integration Test Scenarios

- Detection → Profile Selection → Config Generation (end-to-end)
- Model Loading Rejection (insufficient RAM scenario)
- GPU Fallback (probe failure → CPU mode)
- Memory Pressure Evaluation (critical threshold)
