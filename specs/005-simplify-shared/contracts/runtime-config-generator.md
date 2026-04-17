# Public API Contract: Runtime Configuration Generation

**Module**: `shared/ai`  
**Primary Consumer**: `features/chat`, `shared/ai/runtime`  
**Status**: Specification

## Contract: IRuntimeConfigGenerator

### Purpose

Generate optimized llama.cpp runtime configuration from device profile and model metadata, accounting for GPU backend, memory constraints, and device tier.

### Public Methods

#### 1. `selectDeviceProfile(deviceInfo: DeviceInfo): GpuProfile`

Map device capabilities to a standardized profile (budget/midRange/premium).

**Input**:

```typescript
interface DeviceInfo {
  availableRAM: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuBackend: "Metal" | "Vulkan" | "OpenCL" | "none";
  platform: "iOS" | "Android";
}
```

**Output**:

```typescript
interface GpuProfile {
  type: "budget" | "midRange" | "premium";
  backend: "Metal" | "Vulkan" | "OpenCL" | "none";
  enabled: boolean; // True if GPU should be used
  flashAttention: boolean; // True only for iOS Metal on premium
  vramFractionOfRAM: number; // 0.3 (budget), 0.5 (midRange), 0.6 (premium)
}
```

**Logic**:

| Available RAM | Backend Decision (Android)       | Backend Decision (iOS) | Flash Attn | VRAM Fraction |
| ------------- | -------------------------------- | ---------------------- | ---------- | ------------- |
| < 5 GB        | OpenCL (safe default)            | Metal                  | false      | 0.3           |
| 5-7 GB        | Vulkan (if Android 13+) / OpenCL | Metal                  | false      | 0.5           |
| ≥ 7 GB        | Vulkan (if Android 13+) / OpenCL | Metal                  | true       | 0.6           |

**Special Cases**:

- If availableRAM < 1 GB: Set enabled=false even if hasGPU=true
- If platform=Android and osVersion < 13: Use OpenCL regardless of RAM
- If Android GPU probe failed: Set gpuBackend=none, enabled=false

**Error Handling**:

- Never throws; always returns valid GpuProfile
- Logs warnings if falling back due to constraints

---

#### 2. `generateRuntimeConfig(deviceInfo: DeviceInfo, modelPath: string, overrides?: Partial<RuntimeConfig>): Promise<RuntimeConfig>`

Generate complete llama.cpp configuration from device profile and model metadata.

**Input**:

```typescript
interface DeviceInfo { ... }
modelPath: string;           // Path to GGUF model file
overrides?: {
  n_ctx?: number;
  n_batch?: number;
  n_gpu_layers?: number;
  cache_type_k?: "f16" | "q8_0" | "q4_0";
  cache_type_v?: "f16" | "q8_0" | "q4_0";
  // ... other fields
}
```

**Output**:

```typescript
interface RuntimeConfig {
  modelPath: string;
  n_ctx: number; // From model metadata or 1024 default
  n_batch: number; // From device tier
  n_gpu_layers: number; // Based on tier + available RAM
  n_threads: number; // min(cpuCores, 8)
  gpu_device: number; // Default 0
  cache_type_k: "f16" | "q8_0" | "q4_0"; // Tier-dependent quantization
  cache_type_v: "f16" | "q8_0" | "q4_0";
  flash_attn: boolean; // iOS Metal only
  use_mlock: boolean; // true for premium tier
  use_mmap: boolean; // true (default)
  temperature: number; // 0.7 (default)
  top_p: number; // 0.95 (default)
  verbose: boolean; // true if DEBUG mode
}
```

**Steps**:

1. Load ModelMetadata from modelPath
   - If unavailable, use conservative defaults
2. Calculate memory budget
   - Using formula from data-model.md
   - Compare against availableRAM
3. Select device profile via selectDeviceProfile()

4. Determine n_gpu_layers
   - Premium: 50% of total layers to GPU
   - MidRange: 30% to GPU
   - Budget/NoGPU: 0 layers to GPU
5. Select cache quantization
   - Premium: f16 (full precision)
   - MidRange: q8_0 (50% memory reduction)
   - Budget: q4_0 (75% reduction, if model allows)
6. Set threading
   - n_threads = min(cpuCores, 8)
   - llama.cpp has diminishing returns beyond 8 threads
7. Apply overrides
   - Merge user-provided overrides with calculated config
8. Validate final config
   - Check constraints (n_ctx ≤ model max, n_batch ≤ n_ctx, etc.)
   - Log warnings if config reduced due to constraints

**Error Handling**:

- If ModelMetadata unavailable: Log warning, use conservative formula
- If calculated memory exceeds available: Reduce n_ctx or reject with clear message
- Never throw from generateRuntimeConfig; return best-effort config

**Performance**:

- Target: < 50ms (mostly I/O for metadata loading)

---

#### 3. `calculateMemoryBudget(modelPath: string, deviceInfo: DeviceInfo): Promise<{required: number, available: number, sufficient: boolean}>`

Calculate required RAM for a model and compare to available RAM.

**Input**:

```typescript
modelPath: string;
deviceInfo: DeviceInfo;
```

**Output**:

```typescript
{
  required: number; // Required RAM in GB
  available: number; // Available RAM in GB
  sufficient: boolean; // true if available >= required
}
```

**Algorithm**:

1. Try to load ModelMetadata(modelPath)
2. If metadata available:
   - Use formula: Weights + KV Cache + Working Memory (15%) + Overhead (0.5 GB)
   - Adjust cache quantization tier if needed
3. If metadata unavailable:
   - Use conservative fallback: assume f16 quantization, 1024-token context
4. Return {required, available, sufficient}

**Validation**:

- If sufficient=false, log error with exact deficit
- Always returns valid numbers (≥ 0)

---

## Type Exports

```typescript
export interface RuntimeConfig { ... }
export interface GpuProfile { ... }

export const CACHE_TIER_SELECTION = {
  PREMIUM: ["f16", "f16"],           // KV cache types
  MID_RANGE: ["q8_0", "q8_0"],
  BUDGET: ["q4_0", "q4_0"],
} as const;

export const GPU_LAYERS_BY_TIER = {
  PREMIUM: 0.5,    // 50% to GPU
  MID_RANGE: 0.3,  // 30% to GPU
  BUDGET: 0,       // CPU only
} as const;

export const N_BATCH_BY_TIER = {
  PREMIUM: 512,
  MID_RANGE: 256,
  BUDGET: 128,
} as const;
```

---

## Error Contract

### RuntimeConfigError

```typescript
interface RuntimeConfigError extends Error {
  code: "MODEL_METADATA_ERROR" | "MEMORY_INSUFFICIENT" | "VALIDATION_ERROR";
  required?: number; // Required RAM in GB
  available?: number; // Available RAM in GB
  modelPath?: string;
}
```

**Handling Policy**:

- `MEMORY_INSUFFICIENT`: Return sufficient=false; log exact deficit for user feedback
- `MODEL_METADATA_ERROR`: Log warning; use conservative formula instead
- `VALIDATION_ERROR`: Log error; return degraded config (CPU-only, reduced context)

---

## Usage Examples

### Feature Code (Model Loading)

```typescript
import { RuntimeConfigGenerator } from "@/shared/ai";

const generator = new RuntimeConfigGenerator();
const deviceInfo = await deviceDetector.detect();

// Check if model will fit
const budget = await generator.calculateMemoryBudget(modelPath, deviceInfo);
if (!budget.sufficient) {
  throw new Error(
    `Insufficient RAM: ${budget.required}GB required, ${budget.available}GB available`,
  );
}

// Generate optimized config
const config = await generator.generateRuntimeConfig(deviceInfo, modelPath);
await runtime.initialize(config);
```

### Testing (With Mocked Metadata)

```typescript
const generator = new RuntimeConfigGenerator();

const mockDeviceInfo = {
  availableRAM: 5,
  cpuCores: 8,
  hasGPU: true,
  gpuBackend: "Vulkan" as const,
  platform: "Android" as const,
};

const profile = generator.selectDeviceProfile(mockDeviceInfo);
expect(profile.type).toBe("midRange");
expect(profile.flashAttention).toBe(false);
```

---

## Versioning & Changes

**Current Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2026-04-16

### Breaking Changes (Would Require Major Version Bump)

- Changes to RuntimeConfig field types
- Changes to device tier definitions
- Removal of core methods

### Non-Breaking Additions

- New optional overrides in generateRuntimeConfig
- New helper methods for specific calculations
- New cache quantization types (if llama.rn adds them)

---

## Testing Requirements

- ✅ Unit tests: selectDeviceProfile for all tier boundaries
- ✅ Unit tests: cache quantization selection by tier
- ✅ Unit tests: memory budget calculation vs. expected formula
- ✅ Integration tests: end-to-end config generation on mock devices
- ✅ Edge case: Model with no metadata (fallback formula)
- ✅ Edge case: Insufficient memory (budget.sufficient = false)
- ✅ Edge case: Overrides applied correctly
- ✅ Performance: Config generation < 50ms

---
