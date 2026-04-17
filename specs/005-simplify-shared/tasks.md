# Implementation Tasks: Simplify and Adjust @shared for Precision

**Feature**: 005-simplify-shared  
**Branch**: `005-simplify-shared`  
**Status**: Ready for Implementation  
**Date**: 2026-04-16

## Overview

This document defines the actionable, dependency-ordered implementation tasks for refactoring `@shared` to simplify device detection, fix GPU backend selection, implement accurate memory budgeting, and add model integrity verification.

**Phases**:

- Phase 1: Setup & Infrastructure
- Phase 2: Foundational Services (blocking all user stories)
- Phase 3: User Story 1 - Device Capabilities Detection (P1)
- Phase 4: User Story 2 - GPU Acceleration (P1)
- Phase 5: User Story 3 - Memory Budget Calculation (P1)
- Phase 6: User Story 4 - CPU Detection Simplification (P2)
- Phase 7: User Story 5 - Model Integrity Verification (P2)
- Phase 8: Polish & Cross-Cutting Concerns

**MVP Scope** (Recommended): Complete Phases 1-5 (US1-US3) for core reliability. US4-US5 are lower priority improvements.

---

## Phase 1: Setup & Infrastructure

- [x] T001 Create TypeScript interfaces for DI providers in `shared/device/adapters.ts`
- [x] T002 [P] Update `shared/ai/types/index.ts` with DeviceInfo, GpuProfile, RuntimeConfig, MemoryPressure, ModelMetadata types
- [x] T003 [P] Create `shared/ai/types/constants.ts` with device tier definitions, GPU backends, cache types

---

## Phase 2: Foundational Services (Blocking Prerequisites)

### Dependency Injection Setup

- [x] T004 Implement IDeviceInfoProvider interface in `shared/device/adapters.ts` (wraps react-native-device-info)
- [x] T005 [P] Implement IPlatformProvider interface in `shared/device/adapters.ts` (wraps Platform module)
- [x] T006 [P] Implement IMemoryInfoProvider interface in `shared/device/adapters.ts`
- [x] T007 Create `shared/device/index.ts` with default exports (DeviceDetector with default providers)

### Test Infrastructure

- [x] T008 Create `tests/unit/device-detector.test.ts` stub with import of bun:test and type imports only (no react-native)
- [x] T009 [P] Create `tests/unit/runtime-config-generator.test.ts` stub
- [x] T010 [P] Create `tests/unit/memory-monitor.test.ts` stub
- [x] T011 [P] Create `tests/unit/model-loader.test.ts` stub
- [x] T012 Update `tests/setup.ts` to configure Bun test preload if needed (verify bunfig.toml preload is active)

---

## Phase 3: User Story 1 - Device Capabilities Detection is Reliable and Accurate

### Refactor DeviceDetector

- [x] T013 [US1] Refactor `shared/device/detector.ts` to use DI interfaces (IDeviceInfoProvider, IPlatformProvider)
- [x] T014 [US1] Update `detect()` method to calculate available RAM = totalRAM - osOverhead - currentUsage
- [x] T015 [US1] Implement OS overhead constants: iOS 1.5GB, Android 2GB in `shared/device/detector.ts`
- [x] T016 [US1] Add validation to availableRAM: if < 0, set to 0; if < 1GB, flag for GPU disabling (FR-003)
- [x] T017 [US1] Remove or deprecate: cpuBrand detection, performanceCoreRatio calculation, gpuMemoryMB estimation (FR-011)
- [x] T018 [US1] Keep deviceModel and osVersion for logging/debug only, add comment that they are not used for decisions

### Write Unit Tests for Device Detection

- [x] T019 [P] [US1] Write unit tests for DeviceDetector.detect() with mocked providers (budget, midRange, premium tiers)
- [x] T020 [P] [US1] Test OS overhead calculation: iOS 1.5GB, Android 2GB (T015 coverage)
- [x] T021 [P] [US1] Test available RAM validation: negative → 0, low memory flag (<1GB) (T016 coverage)
- [x] T022 [P] [US1] Test edge case: device with <1GB available RAM
- [x] T023 [P] [US1] Test edge case: availableRAM calculation with negative result
- [x] T024 [US1] Run tests: `bun test tests/unit/device-detector.test.ts`

### Write Integration Tests

- [x] T025 [US1] Create `tests/integration/device-detection.test.ts` for end-to-end detection workflow
- [x] T026 [US1] Test detection on mock iOS device with Metal GPU
- [x] T027 [US1] Test detection on mock Android device with Vulkan capability (Android 13+)
- [x] T028 [US1] Test detection on mock Android device without Vulkan (older version)
- [x] T029 [US1] Run integration tests: `bun test tests/integration/device-detection.test.ts`

---

## Phase 4: User Story 2 - GPU Acceleration Works Reliably Across Different Chipsets

### Implement GPU Backend Selection

- [x] T030 [US2] Create `selectGpuBackend(osVersion: string, gpuBrand: string, platform: string): string` function in `shared/ai/runtime-config-generator.ts`
- [x] T031 [US2] Logic: Android 13+ + Snapdragon → Vulkan; Android < 13 or other chips → OpenCL; iOS → Metal
- [x] T032 [US2] Handle edge case: unknown GPU vendor → fallback to platform default (OpenCL Android, Metal iOS)
- [x] T033 [US2] Update `RuntimeConfigGenerator.selectDeviceProfile()` to use selectGpuBackend() (FR-002)

### Implement GPU Probing with Fallback

- [x] T034 [US2] Add `probeGpuBackend(gpuBackend: string): Promise<boolean>` to `shared/ai/runtime-config-generator.ts`
- [x] T035 [US2] Implement timeout-safe GPU initialization attempt (~500ms) with isolated error handling
- [x] T036 [US2] On probe failure: set hasGPU=false, record failure reason for telemetry
- [x] T037 [US2] Integrate probeGpuBackend() into AIRuntime initialization or detectCapabilities() flow
- [x] T038 [US2] Add logging: record GPU backend selection and probe result with timestamps

### Flash Attention Configuration

- [x] T039 [US2] Update RuntimeConfig generation to set flash_attn based on platform and backend (FR-004)
- [x] T040 [US2] Rule: Android → flash_attn: false; iOS Metal → flash_attn: true; others → false
- [x] T041 [US2] Add validation: if flash_attn=true, assert platform="iOS" and gpuBackend="Metal"

### Write Unit Tests for GPU Configuration

- [x] T042 [P] [US2] Test selectGpuBackend() for all tier/platform/osVersion combinations
- [x] T043 [P] [US2] Test GPU probing logic (success and timeout scenarios)
- [x] T044 [P] [US2] Test Flash Attention configuration by platform (Android=false, iOS Metal=true)
- [x] T045 [P] [US2] Test edge case: Snapdragon 8 Gen 2 on Android 13 (should select Vulkan)
- [x] T046 [P] [US2] Test edge case: unknown GPU vendor (should fallback safely)
- [x] T047 [US2] Run tests: `bun test tests/unit/runtime-config-generator.test.ts --grep GPU`

### Write Integration Tests for GPU

- [x] T048 [US2] Create scenario: detect device → select profile → probe GPU → fallback if fails
- [x] T049 [US2] Test on mock Snapdragon device with Vulkan success
- [x] T050 [US2] Test on mock Snapdragon device with Vulkan probe timeout
- [x] T051 [US2] Run GPU integration tests: `bun test tests/integration/gpu-configuration.test.ts`

---

## Phase 5: User Story 3 - Memory Budget Calculation Prevents Out-of-Memory Crashes

### Implement Memory Budget Calculation

- [ ] T052 [US3] Create `calculateMemoryBudget(modelPath: string, deviceInfo: DeviceInfo): Promise<{required: number, available: number, sufficient: boolean}>` in `shared/ai/model-loader.ts`
- [ ] T053 [US3] Integrate `loadLlamaModelInfo(modelPath)` call to fetch model metadata (quantization, context, cache params)
- [ ] T054 [US3] Implement accurate formula: Weights + KV Cache (2 × 32 × context_size × 4096 × 2 bytes in f16) + Working (15%) + Overhead (0.5GB) (FR-005)
- [ ] T055 [US3] Implement fallback formula: if metadata unavailable, use conservative estimate (assume f16, 1024-token context)
- [ ] T056 [US3] Add validation: if required > available, log exact deficit; return sufficient=false

### Implement Pre-Flight Memory Check

- [ ] T057 [US3] Create `preflightCheck(modelPath: string, deviceInfo: DeviceInfo): Promise<PreflightCheckResult>` in `shared/ai/model-loader.ts`
- [ ] T058 [US3] Checks: file exists, memory sufficient, integrity OK (if SHA256 available), platform compatible (FR-006)
- [ ] T059 [US3] Return detailed reasons if canLoad=false (used for user-facing error messages)
- [ ] T060 [US3] Call calculateMemoryBudget() from preflightCheck()

### Integrate Memory Monitoring

- [ ] T061 [US3] Update `MemoryMonitor` to track critical pressure (>85% utilization) (FR-013)
- [ ] T062 [US3] Add `startMonitoring(onCritical?: callback): void` to trigger callback when critical
- [ ] T063 [US3] Integrate memory monitor into model loading workflow (abort if critical during load)

### Implement Model Rejection with User Feedback

- [ ] T064 [US3] Create clear error message template: "Memória insuficiente: XXX GB disponível, YYY GB necessário" (pt-BR) (FR-007)
- [ ] T065 [US3] Integrate preflightCheck result → user-facing error in features/model-management

### Write Unit Tests for Memory Budget

- [ ] T066 [P] [US3] Test calculateMemoryBudget() with mocked model metadata
- [ ] T067 [P] [US3] Test formula accuracy for 7B model with 2048 context window
- [ ] T068 [P] [US3] Test fallback formula when metadata unavailable
- [ ] T069 [P] [US3] Test preflightCheck result for sufficient and insufficient RAM scenarios
- [ ] T070 [P] [US3] Test memory pressure evaluation with mocked RAM values
- [ ] T071 [P] [US3] Test critical pressure threshold (>85%)
- [ ] T072 [US3] Run memory tests: `bun test tests/unit/model-loader.test.ts --grep memory`

### Write Integration Tests for Memory Budget

- [ ] T073 [US3] Create scenario: device detection → config generation → memory budget calculation → pre-flight check
- [ ] T074 [US3] Test model that fits: preflightCheck.canLoad=true
- [ ] T075 [US3] Test model that doesn't fit: preflightCheck.canLoad=false with detailed reasons
- [ ] T076 [US3] Test memory pressure evaluation during model loading
- [ ] T077 [US3] Run memory integration tests: `bun test tests/integration/memory-budget.test.ts`

---

## Phase 6: User Story 4 - CPU Detection is Simplified and Focused

### Simplify CPU Detection

- [ ] T078 [US4] Update DeviceDetector to report actual cpuCores count without brand adjustment (FR-008)
- [ ] T079 [US4] Remove performanceCoreRatio calculation entirely (FR-011)
- [ ] T080 [US4] Update RuntimeConfigGenerator to set n_threads = min(cpuCores, 8) with comment on llama.cpp practical limit
- [ ] T081 [US4] Add validation: n_threads in range [1, 8]

### Write Unit Tests for CPU Detection

- [ ] T082 [P] [US4] Test n_threads capping at 8 for device with 12 cores
- [ ] T083 [P] [US4] Test n_threads = cpuCores for device with 4 cores
- [ ] T084 [P] [US4] Test that performanceCoreRatio is not calculated (removed)
- [ ] T085 [US4] Run CPU tests: `bun test tests/unit/runtime-config-generator.test.ts --grep CPU`

---

## Phase 7: User Story 5 - Model Integrity is Verified and App Stability is Protected

### Implement SHA256 Verification

- [ ] T086 [US5] Create `verifyIntegrity(modelPath: string, expectedHash?: string): Promise<IntegrityResult>` in `shared/ai/model-loader.ts`
- [ ] T087 [US5] Implement streaming SHA256 hash calculation (avoid memory spike for large files) (FR-009)
- [ ] T088 [US5] Compare calculated hash to expected value (if provided)
- [ ] T089 [US5] Return IntegrityResult with calculated hash, expected hash, and matches flag
- [ ] T090 [US5] Integrate verifyIntegrity() into preflightCheck()

### Implement Model Rejection on Integrity Failure

- [ ] T091 [US5] Update preflightCheck to set integrityStatus: "verified" | "unverified" | "failed"
- [ ] T092 [US5] If integrityStatus="failed", set canLoad=false with reason "Model integrity check failed; consider re-downloading"
- [ ] T093 [US5] Add logging: log integrity check results for diagnostics

### Write Unit Tests for Integrity Verification

- [ ] T094 [P] [US5] Test SHA256 calculation and comparison (matching hash)
- [ ] T095 [P] [US5] Test SHA256 verification failure (mismatched hash)
- [ ] T096 [P] [US5] Test streaming hash calculation performance (target: <5s for 7GB file)
- [ ] T097 [US5] Run integrity tests: `bun test tests/unit/model-loader.test.ts --grep integrity`

### Write Integration Tests for Model Loading

- [ ] T098 [US5] Create scenario: download model → verify integrity → pre-flight check → load
- [ ] T099 [US5] Test successful model load with valid integrity
- [ ] T100 [US5] Test model rejection due to integrity failure
- [ ] T101 [US5] Run model loading integration tests: `bun test tests/integration/model-loading.test.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

### Documentation & Examples

- [ ] T102 Update README.md with feature overview and usage examples
- [ ] T103 [P] Update inline comments in all refactored modules to explain design decisions (English)
- [ ] T104 [P] Create code examples in docs/ directory (device detection, runtime config, model loading)
- [ ] T105 Verify all user-facing strings are in Brazilian Portuguese (pt-BR)

### Testing & Quality

- [ ] T106 Run full test suite: `bun test tests/**/*.test.ts`
- [ ] T107 [P] Check test coverage: `bun test tests/**/*.test.ts --coverage`
- [ ] T108 [P] Target: ≥80% coverage on shared/device and shared/ai modules
- [ ] T109 Run linting: `bun run lint`
- [ ] T110 Fix any linting violations in refactored code

### Performance Verification

- [ ] T111 Benchmark device detection performance (target: <100ms)
- [ ] T112 [P] Benchmark runtime config generation (target: <50ms)
- [ ] T113 [P] Benchmark memory evaluation (target: <10ms)
- [ ] T114 [P] Benchmark pre-flight check (target: <1s)
- [ ] T115 Create performance report in docs/performance-benchmarks.md

### Edge Case Handling

- [ ] T116 Test device with <1GB available RAM (edge case from spec)
- [ ] T117 [P] Test OS overhead calculation resulting in negative available RAM
- [ ] T118 [P] Test model requiring more memory than device total RAM
- [ ] T119 [P] Test unknown GPU vendor detection
- [ ] T120 Document edge case handling in docs/architecture/

### Code Review Preparation

- [ ] T121 Run Copilot code review on all refactored modules
- [ ] T122 [P] Address any review feedback
- [ ] T123 [P] Update CHANGELOG.md with feature summary

---

## Task Dependencies

### Critical Path (Minimal Viable Product)

```
T001-T003 (Setup) → T004-T012 (Infrastructure)
  ↓
  ├→ T013-T024 (US1: Device Detection) →
  │
  ├→ T030-T047 (US2: GPU Acceleration) →
  │
  └→ T052-T077 (US3: Memory Budget) →
        T102-T110 (Polish)
```

### Recommended Full Scope (All Features)

```
... Critical Path ...
  → T078-T085 (US4: CPU Simplification) →
  → T086-T101 (US5: Model Integrity) →
  → T111-T123 (Final Polish)
```

### Parallelizable Tasks

**During Phase 3 (US1)**:

- T019-T024 (unit tests) can run in parallel with T013-T018 (refactoring)

**During Phase 4 (US2)**:

- T042-T047 (unit tests) can run in parallel with T030-T041 (implementation)

**During Phase 5 (US3)**:

- T066-T072 (unit tests) can run in parallel with T052-T065 (implementation)

---

## Test Commands

Run tests for each phase:

```bash
# Phase 1-2: Infrastructure
bun test tests/unit/device-detector.test.ts

# Phase 3: US1 - Device Detection
bun test tests/unit/device-detector.test.ts
bun test tests/integration/device-detection.test.ts

# Phase 4: US2 - GPU Acceleration
bun test tests/unit/runtime-config-generator.test.ts --grep GPU
bun test tests/integration/gpu-configuration.test.ts

# Phase 5: US3 - Memory Budget
bun test tests/unit/model-loader.test.ts --grep memory
bun test tests/integration/memory-budget.test.ts

# Phase 6: US4 - CPU Detection
bun test tests/unit/runtime-config-generator.test.ts --grep CPU

# Phase 7: US5 - Model Integrity
bun test tests/unit/model-loader.test.ts --grep integrity
bun test tests/integration/model-loading.test.ts

# All tests
bun test tests/**/*.test.ts
bun test tests/**/*.test.ts --coverage
```

---

## Success Criteria & Validation

### Phase 3 (US1) Validation

- ✅ Device detection returns accurate availableRAM (within ±500MB of actual)
- ✅ Models that fit load successfully
- ✅ Unit tests: ≥4 test cases per method
- ✅ Integration tests: End-to-end detection workflow

### Phase 4 (US2) Validation

- ✅ Snapdragon 8 Gen 2 devices select Vulkan backend
- ✅ Older Android devices fall back to OpenCL
- ✅ iOS devices use Metal
- ✅ GPU probe succeeds without crashes
- ✅ Flash Attention disabled on Android, enabled on iOS Metal only

### Phase 5 (US3) Validation

- ✅ Memory budget calculation accurate (±500MB)
- ✅ Models exceeding available RAM rejected before loading
- ✅ Clear user-facing error messages
- ✅ Zero OOM crashes on real devices
- ✅ Pre-flight check < 1s performance

### Phase 6 (US4) Validation

- ✅ CPU core count reported accurately
- ✅ n_threads capped at 8
- ✅ No brand-specific performance ratio calculations

### Phase 7 (US5) Validation

- ✅ SHA256 verification detects corrupted models
- ✅ Model integrity check < 5s for 7GB file
- ✅ Clear error message on integrity failure

---

**Generated**: 2026-04-16  
**Status**: Ready for Implementation  
**Estimated Duration**: 3-4 weeks (parallel execution recommended)
