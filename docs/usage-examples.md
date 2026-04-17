# Shared Module Usage Examples

## Device Detection

```typescript
import { DeviceDetector } from "@/shared/device";

const detector = new DeviceDetector();
const deviceInfo = await detector.detect();
// { totalRAM: 8, availableRAM: 5.5, cpuCores: 6, hasGPU: true,
//   gpuBackend: "Metal", platform: "iOS", osVersion: "17.2" }
```

## Runtime Config Generation

```typescript
import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";
import { DeviceDetector } from "@/shared/device";

const detector = new DeviceDetector();
const generator = new RuntimeConfigGenerator();

const deviceInfo = await detector.detect();
const config = generator.generateRuntimeConfig(
  deviceInfo,
  "/path/to/model.gguf",
);
// { n_ctx: 2048, n_batch: 512, n_threads: 6, gpu_layers: 35,
//   cache_type_k: "q8_0", flash_attn: true }
```

## Memory Budget & Preflight Check

```typescript
import {
  calculateMemoryBudget,
  preflightCheck,
} from "@/shared/ai/model-budget";

// Pure calculation (no filesystem access)
const budget = calculateMemoryBudget(
  4.2, // model size in GB
  2048, // context window
  "q8_0", // KV cache quantization
  5.5, // available RAM in GB
);
// { requiredGB: 5.42, availableGB: 5.5, sufficient: true, breakdown: {...} }

// Full preflight check (filesystem + optional integrity)
const result = await preflightCheck({
  modelPath: "/path/to/model.gguf",
  availableRAM: 5.5,
  contextSize: 2048,
  kvCacheType: "q8_0",
  expectedHash: "abc123...", // optional SHA256
});
// { canLoad: true, ramSufficient: true, integrityOk: true, reasons: [] }
```

## Memory Monitoring

```typescript
import { MemoryMonitor } from "@/shared/ai/memory-monitor";

const monitor = new MemoryMonitor();
monitor.startMonitoring((pressure) => {
  console.warn("Critical memory pressure:", pressure.utilizationPercent);
  // Show user warning or abort model inference
});
```
