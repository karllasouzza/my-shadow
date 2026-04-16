# my-shadow Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-15

## Active Technologies

- TypeScript (React Native / Expo Router) + `llama.rn` (llama.cpp bindings), `@react-native`, `expo-router` (001-optimize-runtime-planning)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript (React Native / Expo Router): Follow standard conventions

## Recent Changes

- 001-optimize-runtime-planning: Added TypeScript (React Native / Expo Router) + `llama.rn` (llama.cpp bindings), `@react-native`, `expo-router`

<!-- MANUAL ADDITIONS START -->

## Runtime Optimization Patterns (001-optimize-runtime-planning)

### Device Profile Selection

Always use the DI-friendly service pattern — never call native APIs directly in components:

```typescript
import { DeviceDetector } from "@/shared/ai/device-detector";
import { RuntimeConfigGenerator } from "@/shared/ai/runtime-config-generator";

// 1. Detect device capabilities
const detector = new DeviceDetector();
const deviceInfo = await detector.detect();

// 2. Select tier: "budget" | "midRange" | "premium"
const generator = new RuntimeConfigGenerator();
const profile = generator.selectDeviceProfile(deviceInfo);

// 3. Generate full runtime config (with optional overrides)
const config = generator.generateRuntimeConfig(
  deviceInfo,
  modelPath,
  overrides,
);
```

Three tiers: budget (< 5 GB available RAM), midRange (5–7 GB), premium (≥ 7 GB).

### Memory Monitoring Pattern

```typescript
import { MemoryMonitor } from "@/shared/ai/memory-monitor";

const monitor = new MemoryMonitor();
monitor.configure({ n_ctx: 1024, n_batch: 64 });

// Always await — evaluate() is async
const pressure = await monitor.evaluate();
if (pressure.criticalLevel) {
  // > 85% utilization — trigger fallback or warn user
}
```

### Dependency Injection Constraint (Testing)

`react-native` uses Flow `import typeof` syntax which bun 1.x cannot parse. **Never import `react-native` directly in test files.** All services accept DI interfaces:

```typescript
// Device detection tests
import type {
  IDeviceInfoProvider,
  IPlatformProvider,
} from "@/shared/ai/device-detector";
const detector = new DeviceDetector(
  mockDeviceInfoProvider,
  mockPlatformProvider,
);

// Memory monitor tests
import type { IMemoryInfoProvider } from "@/shared/ai/memory-monitor";
const monitor = new MemoryMonitor(mockMemoryInfoProvider);
```

### Native-Only Constraint

This is an iOS/Android-only app (Expo Router native mode). **Do not use:**

- `next/*` imports
- `div`, `main`, `aside`, `section`, or any HTML elements
- Web-only APIs (`window`, `document`, `localStorage`)

### KV Cache Quantization

`llama.rn` v0.10.1+ supports `cache_type_k` / `cache_type_v` natively.

- `"f16"` — full precision (premium tier)
- `"q8_0"` — 50% memory reduction, < 2% quality loss (budget/midRange)
- `"q4_0"` — 75% memory reduction, ≥ 5% quality loss (edge case only)

<!-- MANUAL ADDITIONS END -->
