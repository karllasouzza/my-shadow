# Runtime Optimization Troubleshooting Guide

**Feature**: llama.rn Adaptive Runtime  
**Services**: `DeviceDetector`, `RuntimeConfigGenerator`, `MemoryMonitor`

---

## Frequently Asked Questions

### Q: How do I check what device tier was detected?

Add a log statement after loading the model. The AIRuntime logs the tier automatically:

```typescript
// Look for this in the console during loadModel():
// [AIRuntime] Selected tier: budget | midRange | premium
```

Or query it directly:

```typescript
import { DeviceDetector } from "@/shared/ai/device-detector";
import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";

const detector = new DeviceDetector();
const deviceInfo = await detector.detect();
const generator = new RuntimeConfigGenerator();
const profile = generator.selectDeviceProfile(deviceInfo);

console.log("Detected tier:", profile.tier);
console.log("Available RAM:", deviceInfo.availableRAM.toFixed(2), "GB");
console.log("Config:", generator.generateRuntimeConfig(deviceInfo, "/path/to/model.gguf"));
```

---

### Q: How do I force a specific tier for testing?

Override `n_ctx`, `n_batch`, and other parameters when calling `loadModel()`:

```typescript
// Force budget-tier config for testing on a premium device
await aiRuntime.loadModel(modelId, modelPath, {
  n_ctx: 1024,
  n_batch: 64,
  n_gpu_layers: 0,
  cache_type_k: "q8_0",
  cache_type_v: "q8_0",
});
```

To test with a simulated device (unit tests), use the DI pattern:

```typescript
import { DeviceDetector } from "@/shared/ai/device-detector";
import type { IDeviceInfoProvider, IPlatformProvider } from "@/shared/ai/device-detector";

const mockProvider: IDeviceInfoProvider = {
  getTotalMemory: () => Promise.resolve(4 * 1024 ** 3), // 4 GB
  getUsedMemory: () => Promise.resolve(0.8 * 1024 ** 3),
  getMaxMemory: () => Promise.resolve(8),
  getBrand: () => "Qualcomm",
  getSystemVersion: () => "12.0",
  getModel: () => "Pixel 4a",
};

const mockPlatform: IPlatformProvider = { OS: "android" };
const detector = new DeviceDetector(mockProvider, mockPlatform);
const deviceInfo = await detector.detect();
```

---

### Q: How do I interpret memory monitor warnings?

`MemoryMonitor.evaluate()` returns a `MemoryPressure` object:

```typescript
import { MemoryMonitor } from "@/shared/ai/memory-monitor";

const monitor = new MemoryMonitor();
monitor.configure({ n_ctx: 1024, n_batch: 64 });
const pressure = await monitor.evaluate();

console.log({
  utilization: `${pressure.utilizationPercent}%`,
  critical: pressure.criticalLevel,     // > 85% is critical
  canInfer: pressure.canRunInference,   // false if RAM exhausted
  maxCtx: pressure.recommendedMaxContext,
});
```

**Threshold guide:**
| `utilizationPercent` | Meaning |
|----------------------|---------|
| 0–50% | Healthy — full context available |
| 50–70% | Moderate — consider reducing context |
| 70–85% | High — inference may be slow |
| > 85% | Critical — OOM fallback triggers |

---

### Q: The OOM fallback triggered — what happened?

The AIRuntime automatically:
1. Detects the OOM error in `streamCompletion()`
2. Checks `MemoryMonitor.evaluate()` for critical pressure (> 85%)
3. Reduces `n_ctx` by 50% (e.g., 1024 → 512)
4. Reloads the model with the degraded config
5. Retries inference once

You'll see this in logs:
```
[AIRuntime] Memory critical (87%). Reloading with degraded config (n_ctx=512).
```

If the retry also fails, the user sees: `"Memória insuficiente. Tente novamente com contexto < X tokens."`

**To prevent frequent fallbacks:**
- Reduce conversation history before sending
- Clear chat context when approaching token limit

---

### Q: Why does the GPU setting seem ignored on Android?

Android GPU detection is heuristic (30% of system RAM as estimated VRAM). On budget devices:
- 4 GB total × 30% = 1.2 GB estimated VRAM  
- If estimated VRAM < 1 GB, `n_gpu_layers` is capped to 20

On iOS, the Metal GPU shares system RAM — no heuristic override is needed.

---

### Q: KV cache quantization (`q8_0`) — does it affect output quality?

Per spec validation:
- `q8_0` reduces memory by ~50% vs `f16` (1 byte vs 2 bytes per element)
- Perplexity degradation is < 2% in standard benchmarks
- Outputs may occasionally differ from `f16` by ±1 token (within acceptable range)
- `q4_0` (75% reduction) is only used on edge budget scenarios and has ≥ 5% perplexity impact

---

### Q: My tests fail with "import typeof" error in bun

React Native uses Flow type syntax in `node_modules/react-native/index.js` which bun 1.x cannot parse.

**Solution**: Use the injection pattern — never import `react-native` from test files directly.

```typescript
// ❌ WRONG — causes bun parse error
import { Platform } from "react-native";

// ✅ CORRECT — inject a mock IDeviceInfoProvider / IPlatformProvider
const mockPlatform: IPlatformProvider = { OS: "android" };
const detector = new DeviceDetector(mockProvider, mockPlatform);
```

All services that depend on `react-native` accept DI interfaces:
- `DeviceDetector(IDeviceInfoProvider?, IPlatformProvider?)`
- `MemoryMonitor(IMemoryInfoProvider?)`

---

## Configuration Override Reference

All fields that can be overridden at `loadModel()` call time:

```typescript
await aiRuntime.loadModel(modelId, modelPath, {
  // Context & batching
  n_ctx: 1024,       // 128–8192
  n_batch: 64,       // 32–2048
  n_ubatch: 32,      // optional micro-batch

  // Threading
  n_threads: 4,      // 1–16

  // GPU
  n_gpu_layers: 0,   // 0 = CPU-only, 99 = full GPU

  // Memory
  use_mmap: true,    // always true on low-RAM
  use_mlock: false,  // never true on mobile

  // KV cache
  cache_type_k: "q8_0", // "f16" | "q8_0" | "q4_0"
  cache_type_v: "q8_0",

  // Inference params
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
});
```
