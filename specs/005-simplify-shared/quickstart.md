# Quickstart: Simplify & Adjust @shared for Precision

**Feature**: 005-simplify-shared  
**Target Audience**: Feature developers (chat, model-management), contributors to shared/ai  
**Language**: English (code), Brazilian Portuguese (UI strings)

## Overview

The `@shared` module provides device detection, AI runtime configuration, and memory management for running local LLMs on resource-constrained mobile devices. This refactor simplifies the module to:

1. **Fix GPU backend selection** on modern Snapdragon devices (Vulkan on Android 13+, Metal on iOS)
2. **Implement accurate memory budgeting** using model metadata
3. **Prevent out-of-memory crashes** with rigorous pre-flight checks
4. **Simplify CPU detection** (remove false-precision brand ratios)
5. **Add model integrity verification** via SHA256

---

## Key Modules

### 1. Device Detection (`shared/device`)

Detect device capabilities: RAM, CPU cores, GPU backend, platform, OS version.

```typescript
import { DeviceDetector } from "@/shared/device";

const detector = new DeviceDetector();
const deviceInfo = await detector.detect();

// DeviceInfo { totalRAM: 8, availableRAM: 5.2, cpuCores: 8, hasGPU: true, gpuBackend: "Vulkan", ... }
```

**Key Decision**: Uses Dependency Injection for testability (no direct react-native imports in tests).

---

### 2. Runtime Configuration (`shared/ai`)

Generate optimized llama.cpp configuration from device profile and model metadata.

```typescript
import { RuntimeConfigGenerator } from "@/shared/ai";
import { DeviceDetector } from "@/shared/device";

const detector = new DeviceDetector();
const generator = new RuntimeConfigGenerator();

const deviceInfo = await detector.detect();
const profile = generator.selectDeviceProfile(deviceInfo);
// GpuProfile { type: "midRange", backend: "Vulkan", enabled: true, flashAttention: false, ... }

const config = await generator.generateRuntimeConfig(deviceInfo, modelPath);
// RuntimeConfig { n_ctx: 2048, n_gpu_layers: 35, cache_type_k: "q8_0", ... }
```

**Device Tiers**:

| Available RAM | Type     | GPU Backend                        | Flash Attn      | VRAM Fraction |
| ------------- | -------- | ---------------------------------- | --------------- | ------------- |
| < 5 GB        | budget   | OpenCL (Android) / Metal (iOS)     | false           | 0.3           |
| 5-7 GB        | midRange | Vulkan (Android 13+) / Metal (iOS) | false           | 0.5           |
| ≥ 7 GB        | premium  | Vulkan (Android 13+) / Metal (iOS) | true (iOS only) | 0.6           |

---

### 3. Memory Monitoring (`shared/ai`)

Monitor device memory pressure and trigger fallbacks when critical (> 85%).

```typescript
import { MemoryMonitor } from "@/shared/ai";

const monitor = new MemoryMonitor();
monitor.configure({ evaluationIntervalMs: 250 });

monitor.startMonitoring((pressure) => {
  if (pressure.criticalLevel) {
    console.warn(`Critical memory: ${pressure.pressurePercentage}%`);
    // Trigger fallback, warn user, reduce context
  }
});

// Later...
const current = monitor.getPressure();
console.log(`Current usage: ${current.pressurePercentage}%`);

monitor.stopMonitoring();
```

---

### 4. Model Loading & Integrity (`shared/ai`)

Load models with pre-flight checks and SHA256 verification.

```typescript
import { ModelLoader } from "@/shared/ai";

const loader = new ModelLoader();

// Step 1: Pre-flight check
const preflight = await loader.preflightCheck(modelPath, deviceInfo);
if (!preflight.canLoad) {
  console.error(`Cannot load: ${preflight.reasons.join(", ")}`);
  return;
}

// Step 2: Load with progress
const result = await loader.load(modelPath, runtimeConfig, {
  onProgress: (percent) => console.log(`${percent}% loaded`),
  timeout: 30000,
});

if (result.success) {
  console.log(`Loaded in ${result.loadTimeMs}ms`);
} else {
  console.error(`Load failed: ${result.error}`);
}

// Verify integrity (optional background check)
const integrity = await loader.verifyIntegrity(modelPath, expectedHash);
if (!integrity.matches) {
  console.error("Model integrity check failed");
}
```

---

## End-to-End Workflow

### Complete Model Loading Example

```typescript
// src/features/chat/hooks/use-model-loader.ts
import { DeviceDetector } from "@/shared/device";
import {
  RuntimeConfigGenerator,
  ModelLoader,
  MemoryMonitor,
} from "@/shared/ai";

export function useModelLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModel = async (modelPath: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Detect device
      const detector = new DeviceDetector();
      const deviceInfo = await detector.detect();

      // 2. Monitor memory
      const monitor = new MemoryMonitor();
      monitor.startMonitoring((pressure) => {
        if (pressure.criticalLevel) {
          throw new Error("Dispositivo sem memória disponível");
        }
      });

      // 3. Pre-flight check
      const loader = new ModelLoader();
      const preflight = await loader.preflightCheck(modelPath, deviceInfo);
      if (!preflight.canLoad) {
        throw new Error(
          `Não é possível carregar modelo: ${preflight.reasons.join(", ")}`,
        );
      }

      // 4. Generate config
      const generator = new RuntimeConfigGenerator();
      const config = await generator.generateRuntimeConfig(
        deviceInfo,
        modelPath,
      );

      // 5. Load model
      const result = await loader.load(modelPath, config, {
        onProgress: (percent) => console.log(`Carregando: ${percent}%`),
        timeout: 30000,
        fallbackToCache: true,
      });

      if (!result.success) {
        throw new Error(`Falha ao carregar: ${result.error}`);
      }

      console.log(`✅ Modelo carregado em ${result.loadTimeMs}ms`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
      monitor.stopMonitoring();
    }
  };

  return { loadModel, isLoading, error };
}
```

---

## Key Design Decisions

### 1. GPU Backend Selection

**Android 13+ with Snapdragon**: Prefer Vulkan (faster, modern)  
**Android < 13 or other chips**: Fall back to OpenCL (stable, legacy)  
**iOS**: Always use Metal (stable, optimized)

```typescript
const profile = generator.selectDeviceProfile(deviceInfo);
// { backend: "Vulkan", enabled: true, flashAttention: false }
```

---

### 2. Memory Budget Accuracy

Use model metadata when available; fallback to conservative formula.

```typescript
// With metadata (accurate):
// requiredRAM = Weights + KV Cache + Working (15%) + Overhead (0.5GB)

// Without metadata (conservative):
// requiredRAM = ModelSize + (2 × 32 × 1024 × 4096 × 2) + (0.15 × ModelSize) + 0.5GB
```

---

### 3. Cache Quantization by Tier

- **Premium** (≥ 7GB): `f16` (full precision, best quality)
- **MidRange** (5-7GB): `q8_0` (50% memory reduction, minimal quality loss)
- **Budget** (< 5GB): `q4_0` (75% reduction, possible quality loss)

---

### 4. Flash Attention Disabled on Android

Flash Attention causes crashes on Adreno GPU (Android). Enabled only on iOS Metal.

```typescript
// Android
config.flash_attn = false;

// iOS with Metal
config.flash_attn = profile.backend === "Metal";
```

---

### 5. CPU Threading Capped at 8

llama.cpp has diminishing returns beyond 8 threads. No brand-specific adjustment.

```typescript
config.n_threads = Math.min(cpuCores, 8);
```

---

## Error Handling & Fallbacks

### Memory Insufficient

```typescript
const preflight = await loader.preflightCheck(modelPath, deviceInfo);
if (!preflight.ramSufficient) {
  // User-facing message (pt-BR)
  const message = `Memória insuficiente: ${preflight.requiredRAM}GB necessário, ${preflight.availableRAM}GB disponível`;
  showAlert(message);
}
```

### Model Integrity Failed

```typescript
const integrity = await loader.verifyIntegrity(modelPath, expectedHash);
if (!integrity.matches) {
  // Suggest re-download
  showAlert("Modelo corrompido. Tente fazer download novamente.");
}
```

### Critical Memory During Load

```typescript
monitor.startMonitoring((pressure) => {
  if (pressure.criticalLevel) {
    // Abort load, fall back to cache
    console.error("Memória crítica durante carregamento");
  }
});
```

---

## Dependency Injection (Testing)

For unit tests, inject mock providers to avoid importing react-native.

```typescript
// tests/unit/device-detector.test.ts
import { describe, it, expect } from "bun:test";
import type { IDeviceInfoProvider, IPlatformProvider } from "@/shared/device";
import { DeviceDetector } from "@/shared/device";

describe("DeviceDetector", () => {
  it("detects device capabilities with mocked providers", async () => {
    const mockDeviceInfoProvider: IDeviceInfoProvider = {
      getTotalRAM: async () => 4,
      getAvailableRAM: async () => 2.5,
      getCPUCores: async () => 8,
      getDeviceModel: async () => "SM-G991B",
      hasGPU: async () => true,
    };

    const mockPlatformProvider: IPlatformProvider = {
      getPlatform: () => "Android",
      getOSVersion: async () => "13.0",
      getGPUBrand: async () => "Adreno",
    };

    const detector = new DeviceDetector(
      mockDeviceInfoProvider,
      mockPlatformProvider,
    );
    const deviceInfo = await detector.detect();

    expect(deviceInfo.totalRAM).toBe(4);
    expect(deviceInfo.availableRAM).toBe(2.5);
    expect(deviceInfo.platform).toBe("Android");
  });
});
```

---

## Performance Budgets

- **Device detection**: < 100ms
- **Runtime config generation**: < 50ms
- **Memory evaluation**: < 10ms per call
- **Pre-flight check**: < 1s (includes metadata loading)
- **Model loading**: < 10s (7B model on 4GB device)
- **SHA256 verification**: < 5s (7GB model file)

---

## Language & Localization

- **Code & Docs**: English
- **User-Facing Messages**: Brazilian Portuguese (pt-BR)

```typescript
// ✅ Code: English
const isLowMemory = availableRAM < 1.0;

// ✅ UI: Brazilian Portuguese
const message = "Dispositivo sem memória disponível";
```

---

## Next Steps

1. **Read Feature Spec**: [specs/005-simplify-shared/spec.md](../spec.md)
2. **Review Data Model**: [specs/005-simplify-shared/data-model.md](../data-model.md)
3. **Study API Contracts**: [specs/005-simplify-shared/contracts/](../contracts/)
4. **Implement Changes**: Tasks will be defined in `/speckit.tasks` command
5. **Run Tests**: `bun test tests/**/*.test.ts`

---

## Resources

- **Expo Router**: https://docs.expo.dev/router/introduction/
- **llama.rn**: https://github.com/jhen0409/llama.rn
- **react-native-device-info**: https://github.com/react-native-device-info/react-native-device-info
- **GGUF Format**: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md

---
