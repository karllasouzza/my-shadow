# Public API Contract: Memory Monitoring Service

**Module**: `shared/ai`  
**Primary Consumer**: `shared/ai/runtime`, `features/chat`  
**Status**: Specification

## Contract: IMemoryMonitor

### Purpose

Continuously monitor device memory pressure and evaluate runtime memory constraints to prevent out-of-memory crashes during model loading and inference.

### Public Methods

#### 1. `configure(options: MemoryMonitorOptions): void`

Configure memory monitoring thresholds and evaluation frequency.

**Input**:

```typescript
interface MemoryMonitorOptions {
  evaluationIntervalMs?: number; // Default 250ms
  criticalThresholdPercent?: number; // Default 85%
  enableTelemetry?: boolean; // Default false
  n_ctx?: number; // Expected context window
  n_batch?: number; // Expected batch size
}
```

**Behavior**:

- Sets up internal timer for periodic evaluation
- Configures pressure calculation thresholds
- Can be called multiple times to reconfigure

**Preconditions**:

- evaluationIntervalMs > 0
- criticalThresholdPercent in range [70, 95]

---

#### 2. `evaluate(): Promise<MemoryPressure>`

Evaluate current memory utilization and return pressure metrics.

**Output**:

```typescript
interface MemoryPressure {
  availableRAM: number; // Current available RAM (GB)
  usedRAM: number; // Current used RAM (GB)
  totalRAM: number; // Total device RAM (GB)
  pressurePercentage: number; // (usedRAM / totalRAM) * 100
  criticalLevel: boolean; // pressurePercentage > threshold
  evaluatedAt: number; // Timestamp (ms)
}
```

**Logic**:

- Query native device info for current RAM status
- Calculate pressure as percentage of total RAM used
- Mark as critical if exceeds configured threshold

**Performance**:

- Target: < 10ms per evaluation
- Safe to call frequently (designed for periodic background monitoring)

**Error Handling**:

- Never throws; returns last known pressure if native API fails
- Logs errors for diagnostics

---

#### 3. `startMonitoring(onCritical?: (pressure: MemoryPressure) => void): void`

Start background memory monitoring loop.

**Input**:

- `onCritical`: Optional callback triggered when pressure reaches critical level

**Behavior**:

- Begins periodic evaluation loop based on `evaluationIntervalMs`
- Calls `onCritical(pressure)` callback if critical threshold exceeded
- Continues until `stopMonitoring()` called
- Safe to call multiple times (ignored if already running)

**Usage Pattern**:

```typescript
monitor.startMonitoring((pressure) => {
  console.warn(`Critical memory: ${pressure.pressurePercentage}%`);
  // Take action: reduce model context, trigger fallback, warn user
});
```

---

#### 4. `stopMonitoring(): void`

Stop background memory monitoring loop and cleanup.

**Behavior**:

- Stops periodic evaluation timer
- Clears internal state
- Safe to call even if monitoring not started

---

#### 5. `getPressure(): MemoryPressure | null`

Get most recent pressure evaluation without triggering new evaluation.

**Output**: Last evaluated MemoryPressure or null if never evaluated

**Use Case**: Quick access to cached pressure state without I/O

---

## Dependency Injection Interface

### IMemoryInfoProvider

```typescript
interface IMemoryInfoProvider {
  getTotalRAM(): Promise<number>; // GB
  getAvailableRAM(): Promise<number>; // GB
  getUsedRAM(): Promise<number>; // GB
}
```

**Implementation**: Wraps react-native-device-info  
**Testing**: Mock provider in test setup

---

## Error Contract

### MemoryMonitorError

```typescript
interface MemoryMonitorError extends Error {
  code: "MEMORY_QUERY_ERROR" | "EVALUATION_ERROR";
  platform?: string;
  originalError?: unknown;
}
```

**Handling Policy**:

- Log errors; don't throw
- Return last known pressure or safe defaults
- Never interrupt monitoring due to evaluation failure

---

## Decision Triggers

### Critical Memory Detected (> 85%)

**Action**: Invoke onCritical() callback

**Recommended Responses**:

1. **Immediate**: Log warning with percentage
2. **User-Facing**: Show notification "Device memory is low"
3. **Runtime**: Consider reducing model context or halting new inference
4. **Fallback**: Switch to cached responses or degraded mode

### Elevated Memory (70-85%)

**Action**: No callback (application can poll via getPressure())

**Recommended Responses**:

1. Don't start new model loads
2. Reduce inference batch size
3. Monitor more frequently

### Normal Memory (< 70%)

**Action**: None (safe for normal operation)

---

## Lifecycle Example

```typescript
// Setup
const monitor = new MemoryMonitor(mockMemoryProvider);
monitor.configure({ evaluationIntervalMs: 250, criticalThresholdPercent: 85 });

// Start monitoring with callback
monitor.startMonitoring((pressure) => {
  if (pressure.criticalLevel) {
    // Trigger fallback or warn user
    console.error(`CRITICAL: ${pressure.pressurePercentage}% RAM used`);
  }
});

// Later: check current pressure
const current = monitor.getPressure();
if (current && current.pressurePercentage > 70) {
  // Don't start new models
}

// Cleanup
monitor.stopMonitoring();
```

---

## Type Exports

```typescript
export interface MemoryPressure { ... }
export interface MemoryMonitorOptions { ... }

export const PRESSURE_LEVELS = {
  NORMAL: { min: 0, max: 70 },
  ELEVATED: { min: 70, max: 85 },
  CRITICAL: { min: 85, max: 100 },
} as const;
```

---

## Versioning & Changes

**Current Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2026-04-16

---

## Testing Requirements

- ✅ Unit tests: pressure calculation with mocked RAM values
- ✅ Unit tests: critical threshold detection
- ✅ Integration tests: monitoring loop callback invocation
- ✅ Edge case: Rapid memory fluctuations
- ✅ Edge case: Provider failure handling
- ✅ Performance: < 10ms per evaluation
- ✅ Cleanup: stopMonitoring() stops timer and releases resources

---
