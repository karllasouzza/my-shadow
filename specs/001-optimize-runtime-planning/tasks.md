Now I'll generate a comprehensive tasks.md file for the 001-optimize-runtime-planning feature. Let me create it with all 9 gaps mapped to specific implementation tasks:

```markdown
# Tasks: Optimize llama.rn Runtime for Low-RAM Devices

**Input**: Design documents from `/specs/001-optimize-runtime-planning/`  
**Branch**: `001-optimize-runtime-planning`  
**Status**: Ready for implementation  
**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ quickstart.md

---

## Overview

This feature optimizes `llama.rn` runtime to support low-RAM devices (3-6GB) through adaptive configuration, device-tier classification, and memory monitoring. The implementation closes 9 critical gaps (G1-G9) identified in the optimization velocity plan.

**Expected Outcomes**:
- ✅ -40-50% RAM usage during inference
- ✅ Support for 3GB+ devices (previously 6GB+)
- ✅ Tokens/sec throughput: +20-50% (8-12 t/s → 15-40 t/s)
- ✅ Crash rate reduction: 35% → <1% on 4GB devices
- ✅ < 2% quality degradation via KV cache quantization

**Gap Mapping Summary**:
| Phase | Gaps | Impact | Effort |
|-------|------|--------|--------|
| Phase 3: Config Optimization | G1, G2, G3, G5 | Critical efficiency | Low |
| Phase 4: Advanced Config | G6, G7, G8, G9 | Important memory savings | Medium |
| Phase 5: KV Cache | (G11 - deferred) | Advanced optimization | High |

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no inter-dependencies)
- Paths follow structure in plan.md: `shared/ai/`, `shared/types/`, `tests/`
- All test tasks use **Bun test runner** (`bun:test`)

---

## Phase 1: Setup & Infrastructure

**Purpose**: TypeScript type definitions and test utilities

- [ ] T001 Create extended DeviceInfo interface in shared/types/device.ts
  - Add `performanceCores: number` field (high-freq P-cores for n_threads calculation)
  - Add `gpuBackend?: "metal" | "opencl" | "vulkan" | null` field
  - Document heuristic: iOS 50% of cores, Android Snapdragon 37.5%, fallback 50%
  - Include JSDoc with example values for different device models

- [ ] T002 [P] Extend RuntimeConfig interface in shared/types/device.ts
  - Add `n_predict?: number` (adaptive generation budget; replaces static 4096)
  - Add `n_parallel?: number` (0 = single decode sequence for mobile optimal)
  - Add `top_k?: number` (40 for sampling reduction)
  - Add `top_p?: number` (0.9 for diversity)
  - Add `min_p?: number` (0.05 for aggressive token filtering)
  - Validate constraints in JSDoc: n_ctx 1024-4096, n_batch 32-512, etc.

- [ ] T003 [P] Add MemoryPressure interface in shared/types/device.ts
  - Add `utilizationPercent: number` (0-100)
  - Add `criticalLevel: boolean` (true if > 85%)
  - Add `canRunInference: boolean`
  - Add `recommendedMaxContext: number`
  - Add `sampledAt: number` (timestamp)

- [ ] T004 [P] Create DeviceProfile interface in shared/types/device.ts
  - Define tier type: `"budget" | "midRange" | "premium"`
  - Add config field: `RuntimeConfig` (profile-specific defaults)
  - Add expectations: ttft range, tokens/sec range, peak memory, crash risk %
  - Add compatibleModels: maxModelSizeGB, recommendedQuantization, warning

- [ ] T005 [P] Create test utilities in tests/utils/device-simulator.ts
  - Implement `mockDeviceInfoBudget()`: 4GB RAM, 4 cores, no GPU
  - Implement `mockDeviceInfoMidRange()`: 6GB RAM, 6 cores, GPU available
  - Implement `mockDeviceInfoPremium()`: 8GB RAM, 8 cores, GPU with VRAM
  - Export `simulateMemoryPressure(percent: number): MemoryPressure`

- [ ] T006 [P] Configure Bun test runner for React Native in bunfig.toml
  - Ensure `preload: ["tests/setup.ts"]` for test initialization
  - Configure test patterns: `tests/**/*.test.ts`
  - Set NODE_ENV=test for DI mocking
  - Verify bun:test import compatibility with react-native mocks

---

## Phase 2: Foundational Services (Blocking Prerequisites)

**Purpose**: Device detection and configuration generation infrastructure  
**⚠️ CRITICAL**: Must complete before runtime integration tasks

- [ ] T007 Implement DeviceDetector.detect() in shared/ai/device-detector.ts
  - Add async `detect(): Promise<DeviceInfo>` method
  - Detect `totalRAM` and `availableRAM` via react-native-device-info
  - Detect `cpuCores` via os.cpus() or native API
  - Detect `platform` ("ios" | "android"), `osVersion`, `deviceModel`
  - Populate `detectionMethod` metadata object with detection sources
  - Return complete DeviceInfo with timestamp

- [ ] T008 [P] Implement platform-specific RAM detection in shared/ai/device-detector.ts
  - iOS: Use react-native-device-info `getTotalMemory()` and `getUsedMemory()`
  - Android: Use react-native-device-info `getTotalMemory()` and `getMaxMemory()`
  - Add fallback to query native MemoryInfo if available
  - Store detection method in `detectionMethod.ram` field

- [ ] T009 [P] Implement GPU/VRAM detection with fallback chain in shared/ai/device-detector.ts
  - Android Vulkan: Attempt native call to vkGetPhysicalDeviceMemoryProperties()
  - Android EGL fallback: If Vulkan unavailable, attempt eglQuerySurface()
  - Heuristic fallback: Estimate VRAM as 30% of system RAM (conservative)
  - iOS Metal: Return unified memory (system RAM is GPU memory)
  - Detect GPU type: "adreno" (Snapdragon), "mali" (ARM), "metal" (Apple), "vulkan" (generic)
  - Store detection method in `detectionMethod.gpu` field

- [ ] T010 [P] Implement performanceCores calculation in shared/ai/device-detector.ts
  - iOS (Apple Silicon): `Math.ceil(cpuCores * 0.5)`
  - Android Snapdragon/Bionic: `Math.ceil(cpuCores * 0.375)`
  - Android Helio/unknown: `Math.max(2, Math.ceil(cpuCores * 0.5))`
  - Populate DeviceInfo.performanceCores field
  - Add comment explaining P-core/E-core split rationale

- [ ] T011 Implement DeviceProfile classification in shared/ai/device-profiles.ts
  - Define `budgetProfile` (3-5GB RAM): n_ctx=1024, n_batch=64, cache_type=q8_0, n_gpu_layers=0
  - Define `midRangeProfile` (5-7GB RAM): n_ctx=2048, n_batch=128, cache_type=q8_0, n_gpu_layers=50
  - Define `premiumProfile` (7GB+ RAM): n_ctx=4096, n_batch=512, cache_type=f16, n_gpu_layers=99
  - Include expectations for each tier: ttft, throughput, crash risk percentages
  - Include compatibleModels guidance (max size, recommended quantization)
  - Export `classifyDeviceTier(availableRAM: number): DeviceTier`

- [ ] T012 [P] Implement RuntimeConfigGenerator core methods in shared/ai/runtime-config-generator.ts
  - Add `selectDeviceProfile(deviceInfo: DeviceInfo): DeviceProfile` (based on availableRAM)
  - Add `generateRuntimeConfig(deviceInfo: DeviceInfo, modelPath: string): RuntimeConfig`
  - Use profile defaults as base, override critical fields based on device capabilities
  - Ensure use_mmap=true and use_mlock=false for all mobile devices
  - Return complete RuntimeConfig for llama.rn initialization

- [ ] T013 Implement MemoryMonitor.evaluate() in shared/ai/memory-monitor.ts
  - Add async `evaluate(): Promise<MemoryPressure>` method
  - Calculate utili-zationPercent: (usedRAM / totalRAM) * 100
  - Set criticalLevel: true if utilizationPercent > 85%
  - Estimate canRunInference: availableRAM > (n_batch * 100 bytes threshold)
  - Calculate recommendedMaxContext based on available RAM ratio
  - Return MemoryPressure with current timestamp

- [ ] T014 [P] Add lifecycle hooks in shared/ai/memory-monitor.ts
  - Implement `onAppBackground(): void` (log available RAM, flag model unload if needed)
  - Implement `onAppForeground(): void` (re-evaluate pressure, log recommendations)
  - Implement `onMemoryWarning(): void` callback (trigger fallback on systems warning)
  - Export for integration with app lifecycle in features/

**Checkpoint**: Device detection, profile selection, and memory monitoring complete. Ready for runtime integration.

---

## Phase 3: Configuration Optimization (Gaps G1-G5)

**Purpose**: Critical low-effort wins targeting threads, batch, predict, and GPU layers

**Gap Coverage**:
- G1: n_threads uses total cores, not performance cores
- G2: n_batch is fixed per tier, not adaptive
- G3: n_predict hardcoded to 4096, not adaptive
- G4: flash_attn always enabled, should gate on GPU
- G5: No sampling parameter tuning

- [ ] T015 Implement n_threads calculation (Gap G1) in shared/ai/runtime-config-generator.ts
  - Add `generateThreadCount(deviceInfo: DeviceInfo): number` method
  - Use `performanceCores - 1` to reserve UI thread
  - Cap at actual CPU core count (Math.min to prevent overallocation)
  - Return max(1, result) to ensure at least 1 thread
  - Add docstring explaining P-core vs E-core strategy

- [ ] T016 Implement adaptive n_batch calculation (Gap G2) in shared/ai/runtime-config-generator.ts
  - Add `calculateOptimalBatch(n_ctx: number, availableRAMBytes: number): number` method
  - Calculate maxByRAM: `Math.floor((availableRAM * 0.3) / 1024)` (30% available RAM)
  - Calculate maxByContext: `Math.floor(n_ctx / 2)` (at most half context size)
  - Return `Math.min(512, Math.max(128, Math.min(maxByContext, maxByRAM)))`
  - Apply to RuntimeConfig generation based on device tier

- [ ] T017 Implement adaptive n_predict (Gap G3) in shared/ai/runtime-config-generator.ts
  - Add `getAdaptiveNPredict(modelSizeGB: number, availableRAMBytes: number): number` method
  - Calculate ratio: availableRAM / (modelSize * 2) (2x safety factor for KV + activations)
  - If ratio < 1: return 512 (severe memory constraint)
  - If ratio < 2: return 1024 (moderate constraint)
  - Otherwise: return 2048 (mobile max — prevent 4096 runaway)
  - Apply to RuntimeConfig n_predict field

- [ ] T018 Implement sampling parameter tuning (Gap G5) in shared/ai/runtime-config-generator.ts
  - Add sampling defaults to RuntimeConfig: `top_k: 40`, `top_p: 0.9`, `min_p: 0.05`
  - Document rationale in code comments:
    - top_k=40 reduces search space vs. 50-100 defaults
    - top_p=0.9 maintains output diversity
    - min_p=0.05 filters improbable tokens aggressively
  - Include in all device profiles (budget, midRange, premium)

- [ ] T019 Implement flash_attn gating (Gap G4) in shared/ai/runtime.ts
  - Add check before setting flash_attn parameters in loadModel()
  - Only enable flash_attn if gpuBackend !== null (GPU available)
  - Log decision: `[AIRuntime] Flash attention: ${hasGPU ? 'enabled' : 'disabled (CPU-only)'}`
  - Pass adjusted config to llama.rn initLlama()

- [ ] T020 Update AIRuntime.loadModel() integration in shared/ai/runtime.ts
  - Call DeviceDetector.detect() on model load
  - Call RuntimeConfigGenerator.generateRuntimeConfig() with detected DeviceInfo
  - Apply adaptive n_threads, n_batch, n_predict from config
  - Log selected tier and key config values for debugging
  - Maintain backward compatibility (optional override params still work)

**Checkpoint**: Critical optimizations (G1-G5) complete. RAM savings ~30-40% expected. Ready for memory monitoring integration.

---

## Phase 4: Advanced Configuration (Gaps G6-G9)

**Purpose**: Important memory and performance improvements

**Gap Coverage**:
- G6: n_parallel set to 1, should be 0
- G7: No model warm-up, should add after load
- G8: dry_penalty_last_n static, should be tier-adaptive
- G9: GPU backend not typed

- [ ] T021 Implement n_parallel optimization (Gap G6) in shared/ai/runtime-config-generator.ts
  - Set n_parallel: 0 in all device profiles (single-thread decode, -30% RAM)
  - Add docstring explaining: "Single-sequence decode reduces activation memory by avoiding parallel branches"
  - Include note: "Inference latency may not change; batch size (n_batch) controls prefill parallelism"

- [ ] T022 Add post-load model warm-up (Gap G7) in shared/ai/runtime.ts
  - After llama.rn initLlama() succeeds, call warmUp() (if available in llama.rn)
  - warmUp() runs single inference pass with dummy input to pre-allocate GPU/cache
  - Expected effect: -50% latency on first TTFT
  - Log: `[AIRuntime] Model warm-up complete (first TTFT optimization applied)`
  - If warmUp() not available, add task T046 to implement via llama.rn manual forward pass

- [ ] T023 Implement tier-adaptive dry_penalty_last_n (Gap G8) in shared/ai/runtime-config-generator.ts
  - Budget tier: dry_penalty_last_n = 32
  - Mid-range tier: dry_penalty_last_n = 48
  - Premium tier: dry_penalty_last_n = 64
  - Document rationale: "Smaller values reduce repetition penalty computation on low-RAM devices"
  - Apply in device profile definitions

- [ ] T024 Add gpuBackend typing and detection (Gap G9) in shared/ai/device-detector.ts
  - Populate DeviceInfo.gpuBackend based on detected GPU:
    - iOS → "metal"
    - Android Adreno → "opencl" (Qualcomm preferred)
    - Android Mali → "vulkan" (ARM Mali preferred)
    - Others → "vulkan" (fallback)
    - CPU-only → null
  - Use gpuBackend in runtime.ts for flash_attn gating (T019)
  - Log selected GPU backend in AIRuntime initialization

- [ ] T025 [P] Implement GPU layer count optimization in shared/ai/runtime-config-generator.ts
  - Budget tier: n_gpu_layers = 0 (CPU-only, safest)
  - Mid-range tier: n_gpu_layers = Math.min(50, detectGPUMemory() / 100)
  - Premium tier: n_gpu_layers = 99 (all layers on GPU if available)
  - Add fallback: If GPU VRAM detection fails, default to tier-standard value
  - Log: `[AIRuntime] GPU layers: ${n_gpu_layers} (available VRAM: ${gpuMemoryMB}MB)`

- [ ] T026 Add memory fallback in streamCompletion() in shared/ai/runtime.ts
  - On inference failure (OOM), check MemoryMonitor.evaluate()
  - If pressure > 85%, reduce n_ctx by 50% and reload model
  - Retry inference once with degraded config
  - If still fails, return error with suggestion: "Try again later or reduce model size"
  - Log all fallback attempts for debugging

**Checkpoint**: Advanced optimizations (G6-G9) complete. Additional -10-15% RAM savings expected. TTFT improvement 50% on first inference.

---

## Phase 5: KV Cache Quantization Support

**Purpose**: Optional but high-impact memory optimization via cache quantization

- [ ] T027 Verify or upgrade llama.rn version in package.json
  - Check current llama.rn version supports `cache_type_k` and `cache_type_v`
  - If not supported (likely < 0.10.1), upgrade to latest available version
  - Run `npm test` to verify no regressions after upgrade
  - Add note to RELEASE-NOTES.md: "Upgraded llama.rn for KV cache quantization support"

- [ ] T028 Implement cache quantization in RuntimeConfigGenerator in shared/ai/runtime-config-generator.ts
  - Add cache_type selection per device tier:
    - Budget: cache_type_k = "q8_0", cache_type_v = "q8_0" (-50% KV memory)
    - Mid-range: cache_type_k = "q8_0", cache_type_v = "q8_0"
    - Premium: cache_type_k = "f16", cache_type_v = "f16" (full precision)
  - Include in all RuntimeConfig configs
  - Document quality impact: "Q8_0 causes ±2-5% perplexity loss (imperceptible)"

- [ ] T029 Add cache quantization validation in shared/ai/runtime-config-generator.ts
  - Add `validateCacheConfig(cache_type_k: string, cache_type_v: string): boolean` method
  - Check both values in enum: "f16" | "q8_0" | "q4_0"
  - Log warning if q4_0 used: "Q4_0 KV cache causes ±8-15% quality loss; recommend for 4GB devices only"
  - Throw error if invalid value (prevent config corruption)

---

## Phase 6: Testing & Validation

**Purpose**: Unit tests for device detection, config generation, and memory monitoring  
**Test Runner**: Bun (`bun:test`)

- [ ] T030 [P] Implement DeviceDetector unit tests in tests/unit/shared/ai/device-detector.test.ts
  - Test `detect()` returns valid DeviceInfo on both platforms
  - Test RAM detection: mock device RAM values and verify output
  - Test CPU core detection: verify performanceCores heuristic for iOS (50%), Snapdragon (37.5%)
  - Test GPU detection fallback: Vulkan → EGL → Heuristic
  - Test detection metadata is populated (timestamp, method fields)
  - Run tests on budget/mid/premium simulated tiers (use device-simulator.ts)

- [ ] T031 [P] Implement RuntimeConfigGenerator unit tests in tests/unit/shared/ai/runtime-config-generator.test.ts
  - Test `selectDeviceProfile()` returns correct tier for each RAM range:
    - 3-4GB → budget
    - 5-6GB → midRange
    - 8GB+ → premium
  - Test budget tier config: n_ctx=1024, n_batch=64, cache_type=q8_0, n_gpu_layers=0
  - Test mid-range tier config: n_ctx=2048, n_batch=128, cache_type=q8_0, n_gpu_layers=50
  - Test premium tier config: n_ctx=4096, n_batch=512, cache_type=f16, n_gpu_layers=99
  - Test adaptive n_threads: cap to actual cores, reserve 1 for UI
  - Test adaptive n_batch: bounded by context/2, RAM*0.3, and 512 global max
  - Test adaptive n_predict: 512 for ratio < 1, 1024 for < 2, 2048 for >= 2
  - Test sampling defaults: top_k=40, top_p=0.9, min_p=0.05

- [ ] T032 [P] Implement MemoryMonitor unit tests in tests/unit/shared/ai/memory-monitor.test.ts
  - Test `evaluate()` returns MemoryPressure with correct utilization calc
  - Test criticalLevel flag: false if < 85%, true if >= 85%
  - Test recommendedMaxContext calculation based on available RAM
  - Test canRunInference flag (true if RAM > n_batch * threshold)
  - Test lifecycle callbacks: onAppBackground(), onAppForeground(), onMemoryWarning()

- [ ] T033 [P] Implement cache quantization tests in tests/unit/shared/ai/runtime-config-generator.test.ts
  - Test cache_type_k and cache_type_v validation
  - Test budget tier gets q8_0 for both K and V
  - Test premium tier gets f16 for both
  - Test q4_0 triggers warning log (if used)

- [ ] T034 [P] Add integration tests for AIRuntime in tests/integration/shared/ai/runtime.test.ts
  - Test loadModel() calls DeviceDetector internally
  - Test loadModel() applies adaptive config based on device tier
  - Test streamCompletion() with budget device config (small n_ctx, low RAM)
  - Test streamCompletion() with premium device config (large n_ctx, high RAM)
  - Test fallback on memory pressure (OOM scenario)
  - Mock llama.rn for testing (don't require actual model file)

- [ ] T035 Add performance benchmark scaffold in tests/performance/runtime-optimization.perf.ts
  - Benchmark n_thread count impact on throughput (single vs. multi-core)
  - Benchmark n_batch size impact on latency and memory
  - Benchmark KV cache quantization (f16 vs. q8_0) quality and speed
  - Store baseline metrics for regression detection
  - Document expected improvements: +20-50% throughput, -40-50% RAM

---

## Phase 7: Integration & Documentation

**Purpose**: App-level integration, documentation, and validation

- [ ] T036 Integrate device profiling into app startup in app/_layout.tsx
  - Call DeviceDetector.detect() in root layout useEffect
  - Store DeviceInfo and selected tier in app state or context
  - Log device info on app launch: "Device: 6GB RAM, Mid-Range tier, Metal GPU"
  - Make device profile available to features (optional: display in settings UI)

- [ ] T037 [P] Update README with optimization results in README.md
  - Document memory savings by tier: budget -50%, mid-range -40%, premium 0%
  - Document throughput gains: +20-50% tokens/second
  - Document supported device threshold: 3GB+ RAM (down from 6GB+)
  - Include TTFT improvements: -50% on first inference with warm-up
  - Add integration quickstart (reference quickstart.md)

- [ ] T038 [P] Create OPTIMIZATION-GUIDE.md with developer integration guide
  - Document device profile auto-detection flow
  - Show optional override examples (if developers need custom config)
  - Include memory monitoring API for advanced use cases
  - Include cache invalidation strategy (SHA256 versioning)
  - Add troubleshooting: how to debug device profile selection

- [ ] T039 [P] Add inline code documentation (TSDoc) in shared/ai/*.ts files
  - Document DeviceDetector methods: heuristic assumptions, fallback chains
  - Document RuntimeConfigGenerator methods: formula for adaptive n_batch, n_predict
  - Document MemoryMonitor thresholds: why 85% critical level
  - Include example values and typical device configurations
  - Ensure all public exports have JSDoc with examples

- [ ] T040 [P] Update CONSTITUTION.md to confirm Bun test runner status
  - Note test migration complete: Jest → Bun
  - Confirm bun:test usage in all test files
  - List any jest → bun compatibility notes
  - Verify 80%+ coverage target for services (DeviceDetector, RuntimeConfigGenerator, MemoryMonitor)

- [ ] T041 Validate quickstart.md code examples in shared/ai/runtime.ts
  - Ensure loadModel() API matches quickstart examples
  - Verify streamCompletion() usage is correct in docs
  - Test code snippets in quickstart.md compile and run
  - Update examples if API changed during implementation

- [ ] T042 Run comprehensive integration test in tests/e2e/runtime-optimization.e2e.ts
  - Load a small model on simulated budget device (mock 4GB RAM)
  - Run inference and verify no OOM crash
  - Verify memory usage < 1.5GB during inference
  - Run inference on simulated premium device (mock 8GB RAM)
  - Verify throughput improvement vs. baseline (if baseline available)

**Checkpoint**: All integration complete. Feature ready for QA and release.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final optimizations, cleanup, and quality improvements

- [ ] T043 [P] Add performance telemetry collection in shared/ai/metrics.ts
  - Collect device profile selection (tier, device model)
  - Collect inference latency (TTFT, throughput)
  - Collect memory usage snapshots (peak RAM, KV cache size)
  - Store metrics in MMKV for later analysis
  - Add opt-out mechanism (privacy-first)

- [ ] T044 [P] Optimize imports and reduce bundle size
  - Audit shared/ai/ for unused imports
  - Move device profiles to lazy-loaded data files if > 5KB
  - Ensure tree-shaking works: no circular dependencies
  - Verify final bundle impact (should be < 100KB total)

- [ ] T045 [P] Add error handling for edge cases in shared/ai/runtime.ts
  - Handle DeviceDetector.detect() timeout (fallback to defaults)
  - Handle missing llama.rn version (graceful degradation)
  - Handle corrupted cache metadata (re-download model)
  - Log all error paths for debugging

- [ ] T046 Implement model warm-up fallback in shared/ai/runtime.ts (if T022 needed)
  - If llama.rn doesn't expose warmUp(), implement via dummy forward pass
  - Run single token prediction with empty input
  - Catch and suppress any errors (warm-up is optional)
  - Log warm-up success/failure

- [ ] T047 [P] Add compatibility check for older React Native versions
  - Verify code works with React Native 0.76+ (minimum per plan)
  - Test device detection on RN 0.76, latest stable
  - Document any API compatibility notes
  - Add version polyfills if needed

- [ ] T048 [P] Consolidate configuration documentation in data-model.md
  - Update data-model.md with final config implementations
  - Add links from plan.md to relevant implementation tasks
  - Create index of all config parameters (n_ctx, n_batch, cache_type, etc.)
  - Add reference table: which task implements which gap

- [ ] T049 Create RELEASE-NOTES.md entry
  - Document feature completeness: all 9 gaps (G1-G9) closed
  - Summarize improvements: RAM reduction -40-50%, throughput +20-50%
  - List new services: DeviceDetector, RuntimeConfigGenerator, MemoryMonitor
  - Include breaking changes (none expected — backward compatible)
  - Add upgrade path from previous version

- [ ] T050 Run full test suite and achieve 80%+ coverage in shared/ai/
  - Execute: `bun test tests/unit/shared/ai/**/*.test.ts`
  - Verify all DeviceDetector tests pass
  - Verify all RuntimeConfigGenerator tests pass
  - Verify all MemoryMonitor tests pass
  - Check coverage: aim for 80%+ lines/branches in core services
  - Fix any failing tests before marking complete

**Checkpoint**: Quality gates passed. Feature ready for production deployment.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Status |
|-------|-----------|--------|
| Phase 1: Setup | None | Can start immediately |
| Phase 2: Foundational | Phase 1 completion | BLOCKS all optimization work |
| Phase 3: Config Optimization | Phase 2 completion | Can run in parallel with Phase 4 |
| Phase 4: Advanced Config | Phase 2 completion | Can run in parallel with Phase 3 |
| Phase 5: KV Cache | Phase 3 completion | Can start after Phase 3 done |
| Phase 6: Testing | Phase 5 completion | Can start after service implementation |
| Phase 7: Integration | Phase 6 completion | Can start once tests passing |
| Phase 8: Polish | Phase 7 completion | Final phase, all others complete |

### Within-Phase Dependencies

**Phase 2 (Foundational)**:
- T007 (detect) must complete before T011-T014 (they use DeviceInfo)
- T008-T010 (platform-specific detect) can run in parallel with each other
- T011-T012 (profiles, config gen) can run in parallel (both use DeviceInfo)

**Phase 3 (Config Optimization**):
- All tasks (T015-T020) depend on Phase 2 completion
- T015-T019 (individual gap fixes) can run in parallel
- T020 (runtime integration) depends on T015-T019 completion

**Phase 4 (Advanced Config)**:
- All tasks (T021-T026) depend on Phase 2 completion
- T021-T025 (gap fixes) can run in parallel
- T026 (memory fallback) depends on Phase 5 MemoryMonitor completion

**Phase 6 (Testing)**:
- T030-T033 (unit tests) can run in parallel
- T034 (integration tests) depends on Phase 7 runtime integration
- T035 (perf benchmarks) can run after services complete

### Parallel Opportunities

**Maximum Parallelization** (with sufficient team capacity):

```
Phase 1 (Setup): All T001-T006 tasks [P] can run in parallel
  ↓
Phase 2 (Foundational):
  - T007-T010 (DeviceDetector) in parallel
  - T011-T012 (Config generation) in parallel
  ↓
Phase 3 & 4 (in parallel):
  - Developer A: Phase 3 Config Optimization (T015-T020)
  - Developer B: Phase 4 Advanced Config (T021-T026)
  ↓
Phase 5 (KV Cache): T027-T029 in sequence (version check → implementation → validation)
  ↓
Phase 6 (Testing):
  - T030-T033 (unit tests) in parallel
  - T034-T035 (integration & perf) can run after Phase 7
  ↓
Phase 7 (Integration): T036-T042 in sequence (must integrate step by step)
  ↓
Phase 8 (Polish): T043-T050 can run in parallel
```

**Sequential Execution** (single developer):
1. Complete Phase 1 (4 hours)
2. Complete Phase 2 (8 hours) — CRITICAL foundation
3. Complete Phase 3 (6 hours) — High-impact wins
4. Complete Phase 4 (6 hours) — Medium-impact wins
5. Complete Phase 5 (3 hours) — Cache quantization
6. Complete Phase 6 (8 hours) — Test coverage
7. Complete Phase 7 (4 hours) — App integration
8. Complete Phase 8 (4 hours) — Polish & release

**Total Estimate**: 40-50 engineering hours (5-6 days for single developer)

---

## Implementation Strategy

### MVP Approach (Recommended)

Deliver in increments to validate each phase:

**Increment 1: Foundation** (Aim for Day 1 EOD)
- Complete Phase 1: Setup & Infrastructure
- Complete Phase 2: Foundational Services
- Checkpoint: Device detection + profiling working standalone

**Increment 2: Critical Wins** (Aim for Day 2 EOD)
- Complete Phase 3: Config Optimization (Gaps G1-G5)
- Begin Phase 6 testing (unit tests for Phase 3)
- Checkpoint: Core optimizations delivering -30-40% RAM savings

**Increment 3: Advanced Optimizations** (Aim for Day 3 EOD)
- Complete Phase 4: Advanced Config (Gaps G6-G9)
- Complete Phase 6: All testing
- Checkpoint: Full optimization suite with -40-50% RAM savings + TTFT improvement

**Increment 4: Production Ready** (Aim for Day 4 EOD)
- Complete Phase 5: KV Cache Quantization support
- Complete Phase 7: App integration + documentation
- Complete Phase 8: Polish & validation
- **RELEASE**: Feature complete, tested, documented

### Testing Strategy

**Test-First Approach** (recommended):

1. Before implementing T015-T020 (Phase 3), write failing tests (Phase 6: T030-T033)
2. Implement Phase 3 to make tests pass
3. Before implementing T021-T026 (Phase 4), write additional tests
4. Implement Phase 4 to make tests pass
5. Before app integration (Phase 7), write E2E test (T042)
6. Implement Phase 7 to make E2E test pass

This ensures each gap fix is validated before moving on.

---

## Gap Closure Checklist

### G1: n_threads uses total cores, not performance cores
- [x] Task: T015 (Implement n_threads calculation)
- [x] Test: T031 (Test adaptive n_threads)
- [x] Validation: Log n_threads in AIRuntime (T020)

### G2: n_batch is fixed, not adaptive
- [x] Task: T016 (Implement calculateOptimalBatch)
- [x] Test: T031 (Test adaptive n_batch)
- [x] Validation: Verify batch sizing in config (T020)

### G3: n_predict hardcoded to 4096, not adaptive
- [x] Task: T017 (Implement getAdaptiveNPredict)
- [x] Test: T031 (Test adaptive n_predict)
- [x] Validation: Verify n_predict in runtime config (T020)

### G4: flash_attn always enabled, should gate on GPU
- [x] Task: T019 (Implement flash_attn gating)
- [x] Test: Not directly testable (depends on llama.rn API)
- [x] Validation: Log flash_attn decision (T019)

### G5: No sampling parameter tuning
- [x] Task: T018 (Implement sampling defaults)
- [x] Test: T031 (Verify sampling in config)
- [x] Validation: Include in all profiles (T011)

### G6: n_parallel set to 1, should be 0
- [x] Task: T021 (Set n_parallel: 0 in profiles)
- [x] Test: Manual verification (set to 0 in profile definitions)
- [x] Validation: Check config output (T031)

### G7: No model warm-up after load
- [x] Task: T022 (Add post-load warm-up)
- [x] Test: Could be added to integration test (T034)
- [x] Validation: Log warm-up completion (T022)

### G8: dry_penalty_last_n static, not tier-adaptive
- [x] Task: T023 (Implement tier-adaptive dry_penalty_last_n)
- [x] Test: T031 (Verify per-tier values)
- [x] Validation: Include in device profiles (T011)

### G9: GPU backend not typed
- [x] Task: T024 (Add gpuBackend typing and detection)
- [x] Test: T030 (Test GPU detection fallback)
- [x] Validation: Use in flash_attn gating (T019)

---

## Acceptance Criteria

All criteria must pass before marking feature COMPLETE:

- [ ] **Functionality**: All 9 gaps (G1-G9) implemented and integrated
- [ ] **Testing**: Unit tests pass for DeviceDetector, RuntimeConfigGenerator, MemoryMonitor (bun test)
- [ ] **Quality**: 80%+ code coverage on core services (shared/ai/)
- [ ] **Performance**: Benchmark shows -40-50% RAM on budget devices, +20-50% throughput
- [ ] **Compatibility**: Works on iOS 14+ and Android 8+ (test on simulators)
- [ ] **Documentation**: README, OPTIMIZATION-GUIDE.md, CONSTITUTION.md updated
- [ ] **Backward Compatibility**: Existing AIRuntime.loadModel() API unchanged
- [ ] **Memory Safety**: No OOM crashes on 4GB device with adaptive fallback
- [ ] **Code Review**: Zero TODO comments or FIXME markers
- [ ] **Commit History**: Clean commits, each mapping to specific gaps/tasks

---

## Notes

- All paths assume Expo Router project structure (shared/, features/, app/, tests/)
- All tests use **Bun test runner** (`bun:test`) — no Jest imports in test files
- React Native device info from `react-native-device-info` package (ensure installed)
- llama.rn version must support cache quantization (v0.10.1+ recommended)
- Backward compatible: Existing code continues to work without changes
- Device profiles are immutable; no runtime mutation
- All gaps are independent; can implement in any order after Phase 2
```

This comprehensive tasks.md file has been generated and ready to output. Let me provide it to you now:

---

```markdown
# Tasks: Optimize llama.rn Runtime for Low-RAM Devices

**Input**: Design documents from `/specs/001-optimize-runtime-planning/`  
**Branch**: `001-optimize-runtime-planning`  
**Status**: Ready for implementation  
**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ quickstart.md

---

## Overview

This feature optimizes `llama.rn` runtime to support low-RAM devices (3-6GB) through adaptive configuration, device-tier classification, and memory monitoring. The implementation closes 9 critical gaps (G1-G9) identified in the optimization velocity plan.

**Expected Outcomes**:
- ✅ -40-50% RAM usage during inference
- ✅ Support for 3GB+ devices (previously 6GB+)
- ✅ Tokens/sec throughput: +20-50% (8-12 t/s → 15-40 t/s)
- ✅ Crash rate reduction: 35% → <1% on 4GB devices
- ✅ < 2% quality degradation via KV cache quantization

**Gap Mapping Summary**:
| Phase | Gaps | Impact | Effort |
|-------|------|--------|--------|
| Phase 3: Config Optimization | G1, G2, G3, G5 | Critical efficiency | Low |
| Phase 4: Advanced Config | G6, G7, G8, G9 | Important memory savings | Medium |
| Phase 5: KV Cache | (G11 - deferred) | Advanced optimization | High |

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no inter-dependencies)
- Paths follow structure in plan.md: `shared/ai/`, `shared/types/`, `tests/`
- All test tasks use **Bun test runner** (`bun:test`)

---

## Phase 1: Setup & Infrastructure

**Purpose**: TypeScript type definitions and test utilities

- [ ] T001 Create extended DeviceInfo interface in shared/types/device.ts
  - Add `performanceCores: number` field (high-freq P-cores for n_threads calculation)
  - Add `gpuBackend?: "metal" | "opencl" | "vulkan" | null` field
  - Document heuristic: iOS 50% of cores, Android Snapdragon 37.5%, fallback 50%
  - Include JSDoc with example values for different device models

- [ ] T002 [P] Extend RuntimeConfig interface in shared/types/device.ts
  - Add `n_predict?: number` (adaptive generation budget; replaces static 4096)
  - Add `n_parallel?: number` (0 = single decode sequence for mobile optimal)
  - Add `top_k?: number` (40 for sampling reduction)
  - Add `top_p?: number` (0.9 for diversity)
  - Add `min_p?: number` (0.05 for aggressive token filtering)
  - Validate constraints in JSDoc: n_ctx 1024-4096, n_batch 32-512, etc.

- [ ] T003 [P] Add MemoryPressure interface in shared/types/device.ts
  - Add `utilizationPercent: number` (0-100)
  - Add `criticalLevel: boolean` (true if > 85%)
  - Add `canRunInference: boolean`
  - Add `recommendedMaxContext: number`
  - Add `sampledAt: number` (timestamp)

- [ ] T004 [P] Create DeviceProfile interface in shared/types/device.ts
  - Define tier type: `"budget" | "midRange" | "premium"`
  - Add config field: `RuntimeConfig` (profile-specific defaults)
  - Add expectations: ttft range, tokens/sec range, peak memory, crash risk %
  - Add compatibleModels: maxModelSizeGB, recommendedQuantization, warning

- [ ] T005 [P] Create test utilities in tests/utils/device-simulator.ts
  - Implement `mockDeviceInfoBudget()`: 4GB RAM, 4 cores, no GPU
  - Implement `mockDeviceInfoMidRange()`: 6GB RAM, 6 cores, GPU available
  - Implement `mockDeviceInfoPremium()`: 8GB RAM, 8 cores, GPU with VRAM
  - Export `simulateMemoryPressure(percent: number): MemoryPressure`

- [ ] T006 [P] Configure Bun test runner for React Native in bunfig.toml
  - Ensure `preload: ["tests/setup.ts"]` for test initialization
  - Configure test patterns: `tests/**/*.test.ts`
  - Set NODE_ENV=test for DI mocking
  - Verify bun:test import compatibility with react-native mocks

---

## Phase 2: Foundational Services (Blocking Prerequisites)

**Purpose**: Device detection and configuration generation infrastructure  
**⚠️ CRITICAL**: Must complete before runtime integration tasks

- [ ] T007 Implement DeviceDetector.detect() in shared/ai/device-detector.ts
  - Add async `detect(): Promise<DeviceInfo>` method
  - Detect `totalRAM` and `availableRAM` via react-native-device-info
  - Detect `cpuCores` via os.cpus() or native API
  - Detect `platform` ("ios" | "android"), `osVersion`, `deviceModel`
  - Populate `detectionMethod` metadata object with detection sources
  - Return complete DeviceInfo with timestamp

- [ ] T008 [P] Implement platform-specific RAM detection in shared/ai/device-detector.ts
  - iOS: Use react-native-device-info `getTotalMemory()` and `getUsedMemory()`
  - Android: Use react-native-device-info `getTotalMemory()` and `getMaxMemory()`
  - Add fallback to query native MemoryInfo if available
  - Store detection method in `detectionMethod.ram` field

- [ ] T009 [P] Implement GPU/VRAM detection with fallback chain in shared/ai/device-detector.ts
  - Android Vulkan: Attempt native call to vkGetPhysicalDeviceMemoryProperties()
  - Android EGL fallback: If Vulkan unavailable, attempt eglQuerySurface()
  - Heuristic fallback: Estimate VRAM as 30% of system RAM (conservative)
  - iOS Metal: Return unified memory (system RAM is GPU memory)
  - Detect GPU type: "adreno" (Snapdragon), "mali" (ARM), "metal" (Apple), "vulkan" (generic)
  - Store detection method in `detectionMethod.gpu` field

- [ ] T010 [P] Implement performanceCores calculation in shared/ai/device-detector.ts
  - iOS (Apple Silicon): `Math.ceil(cpuCores * 0.5)`
  - Android Snapdragon/Bionic: `Math.ceil(cpuCores * 0.375)`
  - Android Helio/unknown: `Math.max(2, Math.ceil(cpuCores * 0.5))`
  - Populate DeviceInfo.performanceCores field
  - Add comment explaining P-core/E-core split rationale

- [ ] T011 Implement DeviceProfile classification in shared/ai/device-profiles.ts
  - Define `budgetProfile` (3-5GB RAM): n_ctx=1024, n_batch=64, cache_type=q8_0, n_gpu_layers=0
  - Define `midRangeProfile` (5-7GB RAM): n_ctx=2048, n_batch=128, cache_type=q8_0, n_gpu_layers=50
  - Define `premiumProfile` (7GB+ RAM): n_ctx=4096, n_batch=512, cache_type=f16, n_gpu_layers=99
  - Include expectations for each tier: ttft, throughput, crash risk percentages
  - Include compatibleModels guidance (max size, recommended quantization)
  - Export `classifyDeviceTier(availableRAM: number): DeviceTier`

- [ ] T012 [P] Implement RuntimeConfigGenerator core methods in shared/ai/runtime-config-generator.ts
  - Add `selectDeviceProfile(deviceInfo: DeviceInfo): DeviceProfile` (based on availableRAM)
  - Add `generateRuntimeConfig(deviceInfo: DeviceInfo, modelPath: string): RuntimeConfig`
  - Use profile defaults as base, override critical fields based on device capabilities
  - Ensure use_mmap=true and use_mlock=false for all mobile devices
  - Return complete RuntimeConfig for llama.rn initialization

- [ ] T013 Implement MemoryMonitor.evaluate() in shared/ai/memory-monitor.ts
  - Add async `evaluate(): Promise<MemoryPressure>` method
  - Calculate utilizationPercent: (usedRAM / totalRAM) * 100
  - Set criticalLevel: true if utilizationPercent > 85%
  - Estimate canRunInference: availableRAM > (n_batch * 100 bytes threshold)
  - Calculate recommendedMaxContext based on available RAM ratio
  - Return MemoryPressure with current timestamp

- [ ] T014 [P] Add lifecycle hooks in shared/ai/memory-monitor.ts
  - Implement `onAppBackground(): void` (log available RAM, flag model unload if needed)
  - Implement `onAppForeground(): void` (re-evaluate pressure, log recommendations)
  - Implement `onMemoryWarning(): void` callback (trigger fallback on systems warning)
  - Export for integration with app lifecycle in features/

**Checkpoint**: Device detection, profile selection, and memory monitoring complete. Ready for runtime integration.

---

## Phase 3: Configuration Optimization (Gaps G1-G5)

**Purpose**: Critical low-effort wins targeting threads, batch, predict, and GPU layers

**Gap Coverage**:
- G1: n_threads uses total cores, not performance cores
- G2: n_batch is fixed per tier, not adaptive
- G3: n_predict hardcoded to 4096, not adaptive
- G4: flash_attn always enabled, should gate on GPU
- G5: No sampling parameter tuning

- [ ] T015 Implement n_threads calculation (Gap G1) in shared/ai/runtime-config-generator.ts
  - Add `generateThreadCount(deviceInfo: DeviceInfo): number` method
  - Use `performanceCores - 1` to reserve UI thread
  - Cap at actual CPU core count (Math.min to prevent overallocation)
  - Return max(1, result) to ensure at least 1 thread
  - Add docstring explaining P-core vs E-core strategy

- [ ] T016 Implement adaptive n_batch calculation (Gap G2) in shared/ai/runtime-config-generator.ts
  - Add `calculateOptimalBatch(n_ctx: number, availableRAMBytes: number): number` method
  - Calculate maxByRAM: `Math.floor((availableRAM * 0.3) / 1024)` (30% available RAM)
  - Calculate maxByContext: `Math.floor(n_ctx / 2)` (at most half context size)
  - Return `Math.min(512, Math.max(128, Math.min(maxByContext, maxByRAM)))`
  - Apply to RuntimeConfig generation based on device tier

- [ ] T017 Implement adaptive n_predict (Gap G3) in shared/ai/runtime-config-generator.ts
  - Add `getAdaptiveNPredict(modelSizeGB: number, availableRAMBytes: number): number` method
  - Calculate ratio: availableRAM / (modelSize * 2) (2x safety factor for KV + activations)
  - If ratio < 1: return 512 (severe memory constraint)
  - If ratio < 2: return 1024 (moderate constraint)
  - Otherwise: return 2048 (mobile max — prevent 4096 runaway)
  - Apply to RuntimeConfig n_predict field

- [ ] T018 Implement sampling parameter tuning (Gap G5) in shared/ai/runtime-config-generator.ts
  - Add sampling defaults to RuntimeConfig: `top_k: 40`, `top_p: 0.9`, `min_p: 0.05`
  - Document rationale in code comments:
    - top_k=40 reduces search space vs. 50-100 defaults
    - top_p=0.9 maintains output diversity
    - min_p=0.05 filters improbable tokens aggressively
  - Include in all device profiles (budget, midRange, premium)

- [ ] T019 Implement flash_attn gating (Gap G4) in shared/ai/runtime.ts
  - Add check before setting flash_attn parameters in loadModel()
  - Only enable flash_attn if gpuBackend !== null (GPU available)
  - Log decision: `[AIRuntime] Flash attention: ${hasGPU ? 'enabled' : 'disabled (CPU-only)'}`
  - Pass adjusted config to llama.rn initLlama()

- [ ] T020 Update AIRuntime.loadModel() integration in shared/ai/runtime.ts
  - Call DeviceDetector.detect() on model load
  - Call RuntimeConfigGenerator.generateRuntimeConfig() with detected DeviceInfo
  - Apply adaptive n_threads, n_batch, n_predict from config
  - Log selected tier and key config values for debugging
  - Maintain backward compatibility (optional override params still work)

**Checkpoint**: Critical optimizations (G1-G5) complete. RAM savings ~30-40% expected. Ready for memory monitoring integration.

---

## Phase 4: Advanced Configuration (Gaps G6-G9)

**Purpose**: Important memory and performance improvements

**Gap Coverage**:
- G6: n_parallel set to 1, should be 0
- G7: No model warm-up, should add after load
- G8: dry_penalty_last_n static, should be tier-adaptive
- G9: GPU backend not typed

- [ ] T021 Implement n_parallel optimization (Gap G6) in shared/ai/runtime-config-generator.ts
  - Set n_parallel: 0 in all device profiles (single-thread decode, -30% RAM)
  - Add docstring explaining: "Single-sequence decode reduces activation memory by avoiding parallel branches"
  - Include note: "Inference latency may not change; batch size (n_batch) controls prefill parallelism"

- [ ] T022 Add post-load model warm-up (Gap G7) in shared/ai/runtime.ts
  - After llama.rn initLlama() succeeds, call warmUp() (if available in llama.rn)
  - warmUp() runs single inference pass with dummy input to pre-allocate GPU/cache
  - Expected effect: -50% latency on first TTFT
  - Log: `[AIRuntime] Model warm-up complete (first TTFT optimization applied)`
  - If warmUp() not available, add task T046 to implement via llama.rn manual forward pass

- [ ] T023 Implement tier-adaptive dry_penalty_last_n (Gap G8) in shared/ai/runtime-config-generator.ts
  - Budget tier: dry_penalty_last_n = 32
  - Mid-range tier: dry_penalty_last_n = 48
  - Premium tier: dry_penalty_last_n = 64
  - Document rationale: "Smaller values reduce repetition penalty computation on low-RAM devices"
  - Apply in device profile definitions

- [ ] T024 Add gpuBackend typing and detection (Gap G9) in shared/ai/device-detector.ts
  - Populate DeviceInfo.gpuBackend based on detected GPU:
    - iOS → "metal"
    - Android Adreno → "opencl" (Qualcomm preferred)
    - Android Mali → "vulkan" (ARM Mali preferred)
    - Others → "vulkan" (fallback)
    - CPU-only → null
  - Use gpuBackend in runtime.ts for flash_attn gating (T019)
  - Log selected GPU backend in AIRuntime initialization

- [ ] T025 [P] Implement GPU layer count optimization in shared/ai/runtime-config-generator.ts
  - Budget tier: n_gpu_layers = 0 (CPU-only, safest)
  - Mid-range tier: n_gpu_layers = Math.min(50, detectGPUMemory() / 100)
  - Premium tier: n_gpu_layers = 99 (all layers on GPU if available)
  - Add fallback: If GPU VRAM detection fails, default to tier-standard value
  - Log: `[AIRuntime] GPU layers: ${n_gpu_layers} (available VRAM: ${gpuMemoryMB}MB)`

- [ ] T026 Add memory fallback in streamCompletion() in shared/ai/runtime.ts
  - On inference failure (OOM), check MemoryMonitor.evaluate()
  - If pressure > 85%, reduce n_ctx by 50% and reload model
  - Retry inference once with degraded config
  - If still fails, return error with suggestion: "Try again later or reduce model size"
  - Log all fallback attempts for debugging

**Checkpoint**: Advanced optimizations (G6-G9) complete. Additional -10-15% RAM savings expected. TTFT improvement 50% on first inference.

---

## Phase 5: KV Cache Quantization Support

**Purpose**: Optional but high-impact memory optimization via cache quantization

- [ ] T027 Verify or upgrade llama.rn version in package.json
  - Check current llama.rn version supports `cache_type_k` and `cache_type_v`
  - If not supported (likely < 0.10.1), upgrade to latest available version
  - Run `npm test` to verify no regressions after upgrade
  - Add note to RELEASE-NOTES.md: "Upgraded llama.rn for KV cache quantization support"

- [ ] T028 Implement cache quantization in RuntimeConfigGenerator in shared/ai/runtime-config-generator.ts
  - Add cache_type selection per device tier:
    - Budget: cache_type_k = "q8_0", cache_type_v = "q8_0" (-50% KV memory)
    - Mid-range: cache_type_k = "q8_0", cache_type_v = "q8_0"
    - Premium: cache_type_k = "f16", cache_type_v = "f16" (full precision)
  - Include in all RuntimeConfig configs
  - Document quality impact: "Q8_0 causes ±2-5% perplexity loss (imperceptible)"

- [ ] T029 Add cache quantization validation in shared/ai/runtime-config-generator.ts
  - Add `validateCacheConfig(cache_type_k: string, cache_type_v: string): boolean` method
  - Check both values in enum: "f16" | "q8_0" | "q4_0"
  - Log warning if q4_0 used: "Q4_0 KV cache causes ±8-15% quality loss; recommend for 4GB devices only"
  - Throw error if invalid value (prevent config corruption)

---

## Phase 6: Testing & Validation

**Purpose**: Unit tests for device detection, config generation, and memory monitoring  
**Test Runner**: Bun (`bun:test`)

- [ ] T030 [P] Implement DeviceDetector unit tests in tests/unit/shared/ai/device-detector.test.ts
  - Test `detect()` returns valid DeviceInfo on both platforms
  - Test RAM detection: mock device RAM values and verify output
  - Test CPU core detection: verify performanceCores heuristic for iOS (50%), Snapdragon (37.5%)
  - Test GPU detection fallback: Vulkan → EGL → Heuristic
  - Test detection metadata is populated (timestamp, method fields)
  - Run tests on budget/mid/premium simulated tiers (use device-simulator.ts)

- [ ] T031 [P] Implement RuntimeConfigGenerator unit tests in tests/unit/shared/ai/runtime-config-generator.test.ts
  - Test `selectDeviceProfile()` returns correct tier for each RAM range:
    - 3-4GB → budget
    - 5-6GB → midRange
    - 8GB+ → premium
  - Test budget tier config: n_ctx=1024, n_batch=64, cache_type=q8_0, n_gpu_layers=0
  - Test mid-range tier config: n_ctx=2048, n_batch=128, cache_type=q8_0, n_gpu_layers=50
  - Test premium tier config: n_ctx=4096, n_batch=512, cache_type=f16, n_gpu_layers=99
  - Test adaptive n_threads: cap to actual cores, reserve 1 for UI
  - Test adaptive n_batch: bounded by context/2, RAM*0.3, and 512 global max
  - Test adaptive n_predict: 512 for ratio < 1, 1024 for < 2, 2048 for >= 2
  - Test sampling defaults: top_k=40, top_p=0.9, min_p=0.05

- [ ] T032 [P] Implement MemoryMonitor unit tests in tests/unit/shared/ai/memory-monitor.test.ts
  - Test `evaluate()` returns MemoryPressure with correct utilization calc
  - Test criticalLevel flag: false if < 85%, true if >= 85%
  - Test recommendedMaxContext calculation based on available RAM
  - Test canRunInference flag (true if RAM > n_batch * threshold)
  - Test lifecycle callbacks: onAppBackground(), onAppForeground(), onMemoryWarning()

- [ ] T033 [P] Implement cache quantization tests in tests/unit/shared/ai/runtime-config-generator.test.ts
  - Test cache_type_k and cache_type_v validation
  - Test budget tier gets q8_0 for both K and V
  - Test premium tier gets f16 for both
  - Test q4_0 triggers warning log (if used)

- [ ] T034 [P] Add integration tests for AIRuntime in tests/integration/shared/ai/runtime.test.ts
  - Test loadModel() calls DeviceDetector internally
  - Test loadModel() applies adaptive config based on device tier
  - Test streamCompletion() with budget device config (small n_ctx, low RAM)
  - Test streamCompletion() with premium device config (large n_ctx, high RAM)
  - Test fallback on memory pressure (OOM scenario)
  - Mock llama.rn for testing (don't require actual model file)

- [ ] T035 Add performance benchmark scaffold in tests/performance/runtime-optimization.perf.ts
  - Benchmark n_thread count impact on throughput (single vs. multi-core)
  - Benchmark n_batch size impact on latency and memory
  - Benchmark KV cache quantization (f16 vs. q8_0) quality and speed
  - Store baseline metrics for regression detection
  - Document expected improvements: +20-50% throughput, -40-50% RAM

---

## Phase 7: Integration & Documentation

**Purpose**: App-level integration, documentation, and validation

- [ ] T036 Integrate device profiling into app startup in app/_layout.tsx
  - Call DeviceDetector.detect() in root layout useEffect
  - Store DeviceInfo and selected tier in app state or context
  - Log device info on app launch: "Device: 6GB RAM, Mid-Range tier, Metal GPU"
  - Make device profile available to features (optional: display in settings UI)

- [ ] T037 [P] Update README with optimization results in README.md
  - Document memory savings by tier: budget -50%, mid-range -40%, premium 0%
  - Document throughput gains: +20-50% tokens/second
  - Document supported device threshold: 3GB+ RAM (down from 6GB+)
  - Include TTFT improvements: -50% on first inference with warm-up
  - Add integration quickstart (reference quickstart.md)

- [ ] T038 [P] Create OPTIMIZATION-GUIDE.md with developer integration guide
  - Document device profile auto-detection flow
  - Show optional override examples (if developers need custom config)
  - Include memory monitoring API for advanced use cases
  - Include cache invalidation strategy (SHA256 versioning)
  - Add troubleshooting: how to debug device profile selection

- [ ] T039 [P] Add inline code documentation (TSDoc) in shared/ai/*.ts files
  - Document DeviceDetector methods: heuristic assumptions, fallback chains
  - Document RuntimeConfigGenerator methods: formula for adaptive n_batch, n_predict
  - Document MemoryMonitor thresholds: why 85% critical level
  - Include example values and typical device configurations
  - Ensure all public exports have JSDoc with examples

- [ ] T040 [P] Update CONSTITUTION.md to confirm Bun test runner status
  - Note test migration complete: Jest → Bun
  - Confirm bun:test usage in all test files
  - List any jest → bun compatibility notes
  - Verify 80%+ coverage target for services (DeviceDetector, RuntimeConfigGenerator, MemoryMonitor)

- [ ] T041 Validate quickstart.md code examples in shared/ai/runtime.ts
  - Ensure loadModel() API matches quickstart examples
  - Verify streamCompletion() usage is correct in docs
  - Test code snippets in quickstart.md compile and run
  - Update examples if API changed during implementation

- [ ] T042 Run comprehensive integration test in tests/e2e/runtime-optimization.e2e.ts
  - Load a small model on simulated budget device (mock 4GB RAM)
  - Run inference and verify no OOM crash
  - Verify memory usage < 1.5GB during inference
  - Run inference on simulated premium device (mock 8GB RAM)
  - Verify throughput improvement vs. baseline (if baseline available)

**Checkpoint**: All integration complete. Feature ready for QA and release.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final optimizations, cleanup, and quality improvements

- [ ] T043 [P] Add performance telemetry collection in shared/ai/metrics.ts
  - Collect device profile selection (tier, device model)
  - Collect inference latency (TTFT, throughput)
  - Collect memory usage snapshots (peak RAM, KV cache size)
  - Store metrics in MMKV for later analysis
  - Add opt-out mechanism (privacy-first)

- [ ] T044 [P] Optimize imports and reduce bundle size
  - Audit shared/ai/ for unused imports
  - Move device profiles to lazy-loaded data files if > 5KB
  - Ensure tree-shaking works: no circular dependencies
  - Verify final bundle impact (should be < 100KB total)

- [ ] T045 [P] Add error handling for edge cases in shared/ai/runtime.ts
  - Handle DeviceDetector.detect() timeout (fallback to defaults)
  - Handle missing llama.rn version (graceful degradation)
  - Handle corrupted cache metadata (re-download model)
  - Log all error paths for debugging

- [ ] T046 Implement model warm-up fallback in shared/ai/runtime.ts (if T022 needed)
  - If llama.rn doesn't expose warmUp(), implement via dummy forward pass
  - Run single token prediction with empty input
  - Catch and suppress any errors (warm-up is optional)
  - Log warm-up success/failure

- [ ] T047 [P] Add compatibility check for older React Native versions
  - Verify code works with React Native 0.76+ (minimum per plan)
  - Test device detection on RN 0.76, latest stable
  - Document any API compatibility notes
  - Add version polyfills if needed

- [ ] T048 [P] Consolidate configuration documentation in data-model.md
  - Update data-model.md with final config implementations
  - Add links from plan.md to relevant implementation tasks
  - Create index of all config parameters (n_ctx, n_batch, cache_type, etc.)
  - Add reference table: which task implements which gap

- [ ] T049 Create RELEASE-NOTES.md entry
  - Document feature completeness: all 9 gaps (G1-G9) closed
  - Summarize improvements: RAM reduction -40-50%, throughput +20-50%
  - List new services: DeviceDetector, RuntimeConfigGenerator, MemoryMonitor
  - Include breaking changes (none expected — backward compatible)
  - Add upgrade path from previous version

- [ ] T050 Run full test suite and achieve 80%+ coverage in shared/ai/
  - Execute: `bun test tests/unit/shared/ai/**/*.test.ts`
  - Verify all DeviceDetector tests pass
  - Verify all RuntimeConfigGenerator tests pass
  - Verify all MemoryMonitor tests pass
  - Check coverage: aim for 80%+ lines/branches in core services
  - Fix any failing tests before marking complete

**Checkpoint**: Quality gates passed. Feature ready for production deployment.

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On | Status |
|-------|-----------|--------|
| Phase 1: Setup | None | Can start immediately |
| Phase 2: Foundational | Phase 1 completion | BLOCKS all optimization work |
| Phase 3: Config Optimization | Phase 2 completion | Can run in parallel with Phase 4 |
| Phase 4: Advanced Config | Phase 2 completion | Can run in parallel with Phase 3 |
| Phase 5: KV Cache | Phase 3 completion | Can start after Phase 3 done |
| Phase 6: Testing | Phase 5 completion | Can start after service implementation |
| Phase 7: Integration | Phase 6 completion | Can start once tests passing |
| Phase 8: Polish | Phase 7 completion | Final phase, all others complete |

### Within-Phase Dependencies

**Phase 2 (Foundational)**:
- T007 (detect) must complete before T011-T014 (they use DeviceInfo)
- T008-T010 (platform-specific detect) can run in parallel with each other
- T011-T012 (profiles, config gen) can run in parallel (both use DeviceInfo)

**Phase 3 (Config Optimization)**:
- All tasks (T015-T020) depend on Phase 2 completion
- T015-T019 (individual gap fixes) can run in parallel
- T020 (runtime integration) depends on T015-T019 completion

**Phase 4 (Advanced Config)**:
- All tasks (T021-T026) depend on Phase 2 completion
- T021-T025 (gap fixes) can run in parallel
- T026 (memory fallback) depends on Phase 5 MemoryMonitor completion

**Phase 6 (Testing)**:
- T030-T033 (unit tests) can run in parallel
- T034 (integration tests) depends on Phase 7 runtime integration
- T035 (perf benchmarks) can run after services complete

### Parallel Opportunities

**Maximum Parallelization** (with sufficient team capacity):

```
Phase 1 (Setup): All T001-T006 tasks [P] can run in parallel
  ↓
Phase 2 (Foundational):
  - T007-T010 (DeviceDetector) in parallel
  - T011-T012 (Config generation) in parallel
  ↓
Phase 3 & 4 (in parallel):
  - Developer A: Phase 3 Config Optimization (T015-T020)
  - Developer B: Phase 4 Advanced Config (T021-T026)
  ↓
Phase 5 (KV Cache): T027-T029 in sequence (version check → implementation → validation)
  ↓
Phase 6 (Testing):
  - T030-T033 (unit tests) in parallel
  - T034-T035 (integration & perf) can run after Phase 7
  ↓
Phase 7 (Integration): T036-T042 in sequence (must integrate step by step)
  ↓
Phase 8 (Polish): T043-T050 can run in parallel
```

**Sequential Execution** (single developer):
1. Complete Phase 1 (4 hours)
2. Complete Phase 2 (8 hours) — CRITICAL foundation
3. Complete Phase 3 (6 hours) — High-impact wins
4. Complete Phase 4 (6 hours) — Medium-impact wins
5. Complete Phase 5 (3 hours) — Cache quantization
6. Complete Phase 6 (8 hours) — Test coverage
7. Complete Phase 7 (4 hours) — App integration
8. Complete Phase 8 (4 hours) — Polish & release

**Total Estimate**: 40-50 engineering hours (5-6 days for single developer)

---

## Implementation Strategy

### MVP Approach (Recommended)

Deliver in increments to validate each phase:

**Increment 1: Foundation** (Aim for Day 1 EOD)
- Complete Phase 1: Setup & Infrastructure
- Complete Phase 2: Foundational Services
- Checkpoint: Device detection + profiling working standalone

**Increment 2: Critical Wins** (Aim for Day 2 EOD)
- Complete Phase 3: Config Optimization (Gaps G1-G5)
- Begin Phase 6 testing (unit tests for Phase 3)
- Checkpoint: Core optimizations delivering -30-40% RAM savings

**Increment 3: Advanced Optimizations** (Aim for Day 3 EOD)
- Complete Phase 4: Advanced Config (Gaps G6-G9)
- Complete Phase 6: All testing
- Checkpoint: Full optimization suite with -40-50% RAM savings + TTFT improvement

**Increment 4: Production Ready** (Aim for Day 4 EOD)
- Complete Phase 5: KV Cache Quantization support
- Complete Phase 7: App integration + documentation
- Complete Phase 8: Polish & validation
- **RELEASE**: Feature complete, tested, documented

### Testing Strategy

**Test-First Approach** (recommended):

1. Before implementing T015-T020 (Phase 3), write failing tests (Phase 6: T030-T033)
2. Implement Phase 3 to make tests pass
3. Before implementing T021-T026 (Phase 4), write additional tests
4. Implement Phase 4 to make tests pass
5. Before app integration (Phase 7), write E2E test (T042)
6. Implement Phase 7 to make E2E test pass

This ensures each gap fix is validated before moving on.

---

## Gap Closure Checklist

### G1: n_threads uses total cores, not performance cores
- [x] Task: T015 (Implement n_threads calculation)
- [x] Test: T031 (Test adaptive n_threads)
- [x] Validation: Log n_threads in AIRuntime (T020)

### G2: n_batch is fixed, not adaptive
- [x] Task: T016 (Implement calculateOptimalBatch)
- [x] Test: T031 (Test adaptive n_batch)
- [x] Validation: Verify batch sizing in config (T020)

### G3: n_predict hardcoded to 4096, not adaptive
- [x] Task: T017 (Implement getAdaptiveNPredict)
- [x] Test: T031 (Test adaptive n_predict)
- [x] Validation: Verify n_predict in runtime config (T020)

### G4: flash_attn always enabled, should gate on GPU
- [x] Task: T019 (Implement flash_attn gating)
- [x] Test: Not directly testable (depends on llama.rn API)
- [x] Validation: Log flash_attn decision (T019)

### G5: No sampling parameter tuning
- [x] Task: T018 (Implement sampling defaults)
- [x] Test: T031 (Verify sampling in config)
- [x] Validation: Include in all profiles (T011)

### G6: n_parallel set to 1, should be 0
- [x] Task: T021 (Set n_parallel: 0 in profiles)
- [x] Test: Manual verification (set to 0 in profile definitions)
- [x] Validation: Check config output (T031)

### G7: No model warm-up after load
- [x] Task: T022 (Add post-load warm-up)
- [x] Test: Could be added to integration test (T034)
- [x] Validation: Log warm-up completion (T022)

### G8: dry_penalty_last_n static, not tier-adaptive
- [x] Task: T023 (Implement tier-adaptive dry_penalty_last_n)
- [x] Test: T031 (Verify per-tier values)
- [x] Validation: Include in device profiles (T011)

### G9: GPU backend not typed
- [x] Task: T024 (Add gpuBackend typing and detection)
- [x] Test: T030 (Test GPU detection fallback)
- [x] Validation: Use in flash_attn gating (T019)

---

## Acceptance Criteria

All criteria must pass before marking feature COMPLETE:

- [ ] **Functionality**: All 9 gaps (G1-G9) implemented and integrated
- [ ] **Testing**: Unit tests pass for DeviceDetector, RuntimeConfigGenerator, MemoryMonitor (bun test)
- [ ] **Quality**: 80%+ code coverage on core services (shared/ai/)
- [ ] **Performance**: Benchmark shows -40-50% RAM on budget devices, +20-50% throughput
- [ ] **Compatibility**: Works on iOS 14+ and Android 8+ (test on simulators)
- [ ] **Documentation**: README, OPTIMIZATION-GUIDE.md, CONSTITUTION.md updated
- [ ] **Backward Compatibility**: Existing AIRuntime.loadModel() API unchanged
- [ ] **Memory Safety**: No OOM crashes on 4GB device with adaptive fallback
- [ ] **Code Review**: Zero TODO comments or FIXME markers
- [ ] **Commit History**: Clean commits, each mapping to specific gaps/tasks

---

## Notes

- All paths assume Expo Router project structure (shared/, features/, app/, tests/)
- All tests use **Bun test runner** (`bun:test`) — no Jest imports in test files
- React Native device info from `react-native-device-info` package (ensure installed)
- llama.rn version must support cache quantization (v0.10.1+ recommended)
- Backward compatible: Existing code continues to work without changes
- Device profiles are immutable; no runtime mutation
- All gaps are independent; can implement in any order after Phase 2
```

---

Here's your comprehensive tasks.md file ready to save. This document:

✅ **Maps all 9 gaps** (G1-G9) from the plan to specific implementation tasks  
✅ **Follows strict checklist format** with `- [ ] [ID] [P?] Description with file path`  
✅ **Organizes by 8 phases** (Setup → Foundational → Optimization → Advanced → KV Cache → Testing → Integration → Polish)  
✅ **Includes test tasks per Bun conventions** (bun:test, not Jest)  
✅ **Provides parallel execution examples** with dependency analysis  
✅ **Each task is LLM-executable** with specific file paths and acceptance criteria  
✅ **50 implementation tasks total** covering all necessary work

You can save this to `/home/karllasouzza/Projects/me/my-shadow/specs/001-optimize-runtime-planning/tasks.md`