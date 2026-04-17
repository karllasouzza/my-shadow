# Public API Contract: Device Detection Service

**Module**: `shared/device`  
**Primary Consumer**: `features/chat`, `features/model-management`, `shared/ai`  
**Status**: Specification

## Contract: IDeviceDetector

### Purpose

Detect device hardware and software capabilities with high accuracy, enabling runtime decisions for GPU backend selection, memory budgeting, and configuration optimization.

### Public Methods

#### 1. `detect(): Promise<DeviceInfo>`

Detect device capabilities (totalRAM, availableRAM, cpuCores, GPU backend, platform, OS version).

**Input**: None (relies on DI-injected providers)

**Output**:

```typescript
interface DeviceInfo {
  totalRAM: number; // GB
  availableRAM: number; // GB (after OS overhead)
  cpuCores: number; // Actual count, no brand adjustment
  hasGPU: boolean; // GPU hardware available
  gpuBackend: "Metal" | "Vulkan" | "OpenCL" | "none";
  platform: "iOS" | "Android";
  osVersion: string; // e.g., "13.0"
  deviceModel: string; // For logging only
  detectedAt: number; // Timestamp (ms)
  gpuBrand?: string; // Debug/logging
}
```

**Error Handling**:

- Throws `DeviceDetectionError` if native API calls fail
- Logs error details with device model for diagnostics
- Returns partial DeviceInfo with safe defaults if non-critical detection fails

**Performance**:

- Target: < 100ms on real devices
- Safe to call on main thread
- Idempotent

**Preconditions**:

- DI providers (IDeviceInfoProvider, IPlatformProvider) must be initialized

**Postconditions**:

- availableRAM ≤ totalRAM
- cpuCores > 0
- If hasGPU=true, then gpuBackend ≠ "none"

---

#### 2. `detectCapabilities(osVersion?: string): Promise<{gpu: GpuProfile, memory: MemoryInfo}>`

Extended detection including GPU probing and memory profiling.

**Input**:

- `osVersion`: Optional OS version (overrides detected value for testing)

**Output**:

```typescript
interface GpuProfile {
  type: "budget" | "midRange" | "premium";
  backend: "Metal" | "Vulkan" | "OpenCL" | "none";
  enabled: boolean;
  flashAttention: boolean;
  vramFractionOfRAM: number;
}

interface MemoryInfo {
  availableRAM: number;
  osOverhead: number; // 1.5GB iOS, 2GB Android
  percentageAvailable: number;
  isLowMemory: boolean;
}
```

**Error Handling**:

- GPU probe timeout (500ms) → fallback to CPU gracefully
- Log GPU probe failures for diagnostics
- Never throw; always return safe defaults

**Performance**:

- Target: < 500ms (includes GPU probe timeout)

---

## Contract: IDependencyInjection Interfaces

### IDeviceInfoProvider

Used by DeviceDetector to access native device information.

```typescript
interface IDeviceInfoProvider {
  getTotalRAM(): Promise<number>; // GB
  getAvailableRAM(): Promise<number>; // GB
  getCPUCores(): Promise<number>;
  getDeviceModel(): Promise<string>; // e.g., "SM-G991B"
  hasGPU(): Promise<boolean>;
}
```

**Implementation**: `shared/device/adapters.ts` (wraps react-native-device-info)  
**Testing**: Mock provider in test setup (avoids importing react-native in tests)

---

### IPlatformProvider

Used by DeviceDetector to detect platform-specific details.

```typescript
interface IPlatformProvider {
  getPlatform(): "iOS" | "Android";
  getOSVersion(): Promise<string>; // e.g., "13.0"
  getGPUBrand(): Promise<"Adreno" | "Mali" | "Metal" | "Unknown">;
}
```

**Implementation**: `shared/device/adapters.ts` (wraps Platform module)  
**Testing**: Mock provider with controlled values

---

## Error Contract

### DeviceDetectionError

Thrown when critical device detection fails.

```typescript
interface DeviceDetectionError extends Error {
  code: "DEVICE_INFO_ERROR" | "PLATFORM_ERROR" | "GPU_PROBE_ERROR";
  platform?: string;
  deviceModel?: string;
  originalError?: unknown;
}
```

**Handling Policy**:

- Log with device context
- Return safe defaults (availableRAM = totalRAM × 0.7, gpuBackend = "none", cpuCores = 2)
- Never propagate to user-facing errors

---

## Usage Examples

### Basic Detection (Feature Code)

```typescript
import { DeviceDetector } from "@/shared/device";

const detector = new DeviceDetector();
const deviceInfo = await detector.detect();

if (deviceInfo.availableRAM < 2) {
  // Use smaller model or reduce context
}
```

### With DI (Testing)

```typescript
import type { IDeviceInfoProvider, IPlatformProvider } from "@/shared/device";

const mockDeviceProvider = {
  getTotalRAM: async () => 4,
  getAvailableRAM: async () => 2.5,
  getCPUCores: async () => 8,
  getDeviceModel: async () => "iPhone15,1",
  hasGPU: async () => true,
};

const mockPlatformProvider = {
  getPlatform: () => "iOS",
  getOSVersion: async () => "17.1",
  getGPUBrand: async () => "Metal",
};

const detector = new DeviceDetector(mockDeviceProvider, mockPlatformProvider);
const deviceInfo = await detector.detect();
```

---

## Versioning & Changes

**Current Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2026-04-16

### Breaking Changes (Would Require Major Version Bump)

- Removal of `detect()` method
- Changes to DeviceInfo field types or semantics
- Removal of DI provider interfaces

### Non-Breaking Additions

- New optional fields in DeviceInfo
- New optional parameters to methods
- New helper methods

---

## Testing Requirements

- ✅ Unit tests for DeviceDetector with mocked providers
- ✅ Integration tests on real iOS/Android devices
- ✅ Edge case: Low-memory device (< 2GB available)
- ✅ Edge case: Device with no GPU
- ✅ Edge case: Older Android without Vulkan

---
