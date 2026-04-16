# Tasks: Optimize llama.rn Runtime for Low-RAM Devices

**Input**: Design documents from `/specs/001-optimize-runtime-planning/`  
**Branch**: `001-optimize-runtime-planning`  
**Status**: Ready for implementation

**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ quickstart.md

---

## Overview

This feature optimizes `llama.rn` runtime to support low-RAM devices (3-6GB) through:

1. Device capability detection (RAM, CPU, GPU)
2. Adaptive runtime configuration (n_ctx, n_batch, cache_type)
3. Three-tier device profiles (budget/mid/premium)
4. Memory pressure monitoring with fallback
5. KV cache quantization (Q8_0) and mmap optimization

**Expected Outcomes**:

- ✅ -50% RAM usage during inference
- ✅ Support for 3GB+ devices (previously 6GB+)
- ✅ < 2% quality degradation
- ✅ Crash rate reduction from 35% → 5% on 4GB devices

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable task (different files, independent)
- **[Story]**: (Not applicable for this optimization feature)
- Paths follow structure in plan.md: `shared/ai/`, `shared/types/`, `tests/`

---

## Phase 1: Setup & Infrastructure

**Purpose**: Project initialization and TypeScript type definitions

- [X] T001 Create device type definitions in shared/types/device.ts
  - Add DeviceInfo interface (RAM, CPU cores, GPU detection)
  - Add DeviceProfile interface (tier, label, config, expectations)
  - Add RuntimeConfig interface (n_ctx, n_batch, cache_type_k/v, etc.)
  - Add CacheMetadata and MemoryPressure interfaces
  - Document constraints for each field (n_ctx: 128-8192, etc.)

- [X] T002 [P] Create test utilities for device simulation in tests/utils/device-simulator.ts
  - Implement mockDeviceInfo() for budget 4GB tier
  - Implement mockDeviceInfo() for mid-range 6GB tier
  - Implement mockDeviceInfo() for premium 8GB+ tier
  - Create helpers for memory pressure simulation

- [X] T003 [P] Initialize Bun test configuration for native tests
  - Configure test runner for iOS/Android compatibility
  - Add device capability mocks (RAM, CPU), use `bun:test`
  - Ensure ES modules work with React Native imports

---

## Phase 2: Foundational Services (Blocking Prerequisites)

**Purpose**: Core device detection and configuration generation infrastructure

**⚠️ CRITICAL**: Must complete before runtime integration

- [X] T004 Implement DeviceDetector service in shared/ai/device-detector.ts
  - Add `detect(): Promise<DeviceInfo>` method
  - Detect total and available RAM (use react-native-device-info)
  - Detect CPU cores via os.cpus() or native API
  - Return platform (ios|android), osVersion, deviceModel
  - Add detection timestamp and method metadata
  - Export DeviceDetector class

- [X] T005 [P] Implement device RAM detection (platform-specific) in shared/ai/device-detector.ts
  - iOS: Use native NSProcessInfo.processInfo.physicalMemory
  - Android: Use ActivityManager.MemoryInfo
  - Fallback to react-native-device-info if native unavailable
  - Ensure available RAM excludes OS + system processes

- [X] T006 [P] Implement GPU/VRAM detection (fallback strategy) in shared/ai/device-detector.ts
  - Android Vulkan detection: Check vkGetPhysicalDeviceMemoryProperties() via native module
  - Android EGL fallback: Attempt eglQuerySurface() if Vulkan unavailable
  - Heuristic fallback: Use 30% of system RAM as estimated VRAM
  - iOS: GPU is unified memory; return system RAM as effective GPU memory
  - Store detection method in DeviceInfo.detectionMethod for debugging

- [X] T007 Implement RuntimeConfigGenerator service in shared/ai/runtime-config-generator.ts
  - Add device profile definitions (budget, midRange, premium)
  - Implement `selectDeviceProfile(deviceInfo): DeviceProfile` method
  - Implement `generateRuntimeConfig(deviceInfo, modelPath): RuntimeConfig` method
  - Base config on device tier (3-tier classification)
  - Adjust n_threads based on CPU cores (max 8, cap to actual cores)
  - Adjust n_gpu_layers based on available VRAM
  - Return config with all required fields (n_ctx, n_batch, cache_type_k/v, use_mmap, use_mlock)

- [X] T008 [P] Create device profile definitions in shared/ai/device-profiles.ts
  - Define `budgetProfile` (3-5GB): n_ctx=1024, n_batch=64, cache_type=q8_0, n_gpu_layers=0
  - Define `midRangeProfile` (5-7GB): n_ctx=2048, n_batch=128, cache_type=q8_0, n_gpu_layers=50
  - Define `premiumProfile` (7GB+): n_ctx=4096, n_batch=512, cache_type=f16, n_gpu_layers=99
  - Include expectations (ttft, tokens/sec, peak memory, crash risk %)
  - Export as map: `const deviceProfiles = { budget, midRange, premium }`
  - Add classification algorithm: `classifyDeviceTier(availableRAM): DeviceTier`

- [X] T009 Implement MemoryMonitor service in shared/ai/memory-monitor.ts
  - Add `evaluate(): MemoryPressure` method (return current RAM state)
  - Calculate utilizationPercent (used/total \* 100)
  - Compute criticalLevel (true if > 85%)
  - Estimate recommendedMaxContext based on available RAM
  - Add `canRunInference`: boolean (check if available RAM > n_batch \* ~100 bytes)
  - Return MemoryPressure with timestamp

- [X] T010 [P] Add lifecycle hooks for memory management in shared/ai/memory-monitor.ts
  - Implement `onAppBackground()` (unload model if pressure high)
  - Implement `onAppForeground()` (reload model if available)
  - Implement `onMemoryWarning()` callback (reduce context or fallback)
  - Export hooks as public methods for app lifecycle integration

**Checkpoint**: Foundation ready. Device detection, profile selection, and memory monitoring complete.

---

## Phase 3: KV Cache Quantization Support

**Purpose**: Implement or wrap KV cache quantization capabilities

- [X] T011 Upgrade `llama.rn` to latest version and verify cache quantization support (shared/ai/cache-quantization.ts)
  - Upgrade `llama.rn` dependency in `package.json` to the latest compatible release
  - Verify whether the upgraded `llama.rn` exposes `cache_type_k` / `cache_type_v` parameters
  - If supported: Create wrapper that passes `cache_type_k`/`cache_type_v` to `initLlama()`
  - If NOT supported after upgrade: Implement an Expo native module wrapper (Phase 2) and document limitation
  - Add CI check that validates `initLlama` accepts cache quantization params

- [X] T012 Add cache quantization validation in shared/ai/runtime-config-generator.ts
  - Validate cache_type_k and cache_type_v are in enum (f16|q8_0|q4_0)
  - Ensure budget tier gets q8_0 default, premium tier gets f16 default
  - Add warning comment if q4_0 used (explains quality trade-off)
  - Export validation function for config validation

---

## Phase 4: Runtime Integration

**Purpose**: Integrate device detection and adaptive config into existing AIRuntime

- [X] T013 Modify AIRuntime class in shared/ai/runtime.ts
  - Add private `deviceDetector: DeviceDetector` property
  - Add private `configGenerator: RuntimeConfigGenerator` property
  - Add private `memoryMonitor: MemoryMonitor` property
  - Modify constructor to initialize detectors (async initialization)
  - Do NOT break existing public API (loadModel, streamCompletion remain unchanged)

- [X] T014 [P] Update AIRuntime.loadModel() to use adaptive config in shared/ai/runtime.ts
  - Before: `loadModel(modelId, path)` — called llama.rn with hardcoded config
  - After: `loadModel(modelId, path, optionalOverrideConfig?)` — calls:
    1. `deviceDetector.detect()` to get DeviceInfo
    2. `configGenerator.generateRuntimeConfig(deviceInfo, path)` to derive RuntimeConfig
    3. Merge with optionalOverrideConfig if provided
    4. Pass final config to `initLlama(config)`
  - Backward compatible: If optionalOverrideConfig not provided, use auto-generated config
  - Log selected tier: `console.log('[AIRuntime] Selected tier:', profile.tier)`

- [X] T015 [P] Update AIRuntime.streamCompletion() for memory pressure fallback in shared/ai/runtime.ts
  - Before: If inference fails, return error
  - After: On failure (OOM), check `memoryMonitor.evaluate()`:
    1. If critical memory pressure (>85%), reduce n_ctx by 50%
    2. Reload model with degraded config
    3. Retry inference once with reduced context
    4. If still fails, return error with helpful message
  - Add fallback context suggestion: "Try again with context < X tokens"

- [X] T016 Add startup memory check in shared/ai/runtime.ts
  - In constructor or app initialization, call `memoryMonitor.evaluate()`
  - If availableRAM < 1.5GB, log warning: "Insufficient RAM for local inference"
  - Store device profile in app state for UI display (optional)

---

## Phase 5: Configuration Validation & Testing

**Purpose**: Ensure runtime configs are valid and tested across device tiers

- [X] T017 [P] Add unit tests for DeviceDetector in tests/unit/device-detector.test.ts
  - Test RAM detection accuracy (mock native APIs)
  - Test CPU core detection
  - Test GPU detection fallback chain (Vulkan → EGL → Heuristic)
  - Test detection metadata recording (method, timestamp)
  - Ensure tests pass on simulated budget/mid/premium tiers

- [X] T018 [P] Add unit tests for RuntimeConfigGenerator in tests/unit/runtime-config-generator.test.ts
  - Test `selectDeviceProfile()` returns correct tier for each RAM range
  - Test budget tier config (n_ctx=1024, n_batch=64, cache_type=q8_0)
  - Test mid-range tier config (n_ctx=2048, n_batch=128, cache_type=q8_0)
  - Test premium tier config (n_ctx=4096, n_batch=512, cache_type=f16)
  - Test config adjustment based on CPU cores (cap n_threads)
  - Test config adjustment based on VRAM (reduce n_gpu_layers if low VRAM)

- [X] T019 [P] Add unit tests for MemoryMonitor in tests/unit/memory-monitor.test.ts
  - Test utilization percent calculation
  - Test critical level detection (>85% = critical)
  - Test `canRunInference()` returns true if available > batch threshold
  - Test `recommendedMaxContext` calculation

- [X] T020 [P] Add integration test for config validation in tests/integration/runtime-config-validation.test.ts
  - Validate all configs against JSON Schema (contracts/runtime-config.schema.json)
  - Test each device profile config passes schema validation
  - Ensure config paths match actual model files
  - Use ajv or similar JSON Schema validator

---

## Phase 6: Model Loading Across Device Tiers

**Purpose**: Validate model loading works reliably on low-RAM devices

- [X] T021 [P] Add integration test for budget tier loading in tests/integration/ai-runtime-loading.test.ts
  - Simulate 4GB RAM device (use device-simulator)
  - Load model with auto-generated budget config
  - Verify config has: n_ctx=1024, n_batch=64, use_mmap=true, use_mlock=false
  - Verify model loads without OOM
  - Verify memory usage stays < 3.5GB (peak)

- [X] T022 [P] Add integration test for mid-range tier loading in tests/integration/ai-runtime-loading.test.ts
  - Simulate 6GB RAM device
  - Load model with auto-generated mid-range config
  - Verify config has: n_ctx=2048, n_batch=128, use_mmap=true
  - Verify memory usage stays < 5.2GB

- [X] T023 [P] Add integration test for premium tier loading in tests/integration/ai-runtime-loading.test.ts
  - Simulate 8GB+ RAM device
  - Load model with auto-generated premium config
  - Verify config has: n_ctx=4096, n_batch=512, use_mmap=false, cache_type_k=f16
  - Verify memory usage optimal for high-RAM device

- [X] T024 Add fallback behavior test in tests/integration/ai-runtime-loading.test.ts
  - Simulate OOM error during initial load
  - Verify AIRuntime triggers memory fallback
  - Verify config is auto-degraded (reduced n_ctx)
  - Verify retry succeeds with degraded config

---

## Phase 7: Inference Quality Validation

**Purpose**: Ensure KV cache quantization maintains acceptable quality

- [X] T025 [P] Add inference quality test in tests/integration/inference-quality.test.ts
  - Run inference on budget config (q8_0 KV cache)
  - Compare output perplexity vs. baseline (f16)
  - Verify perplexity loss < 2% (accepted threshold)
  - Log comparison metrics

- [X] T026 [P] Add consistency test in tests/integration/inference-quality.test.ts
  - Run same prompt 3x on budget tier
  - Verify outputs are consistent (same seeds)
  - Ensure quantization doesn't break determinism

- [X] T027 Add language quality spot-check test in tests/integration/inference-quality.test.ts
  - Generate 100-token reflection prompt on budget tier
  - Manual verification: Output is coherent, not corrupted
  - Check for obvious quantization artifacts (word repetition, nonsense sequences)

---

## Phase 8: End-to-End Testing

**Purpose**: Validate full workflow on low-RAM device simulation

- [X] T028 [P] Add E2E test for chat inference on budget device in tests/e2e/ai-inference-low-ram.test.ts
  - Simulate 4GB RAM device
  - Launch app (use Expo dev client or simulator)
  - Load model via existing ChatScreen flow
  - Send message via UI
  - Verify response arrives without app crash
  - Check memory usage during inference (peak < 3.5GB)

- [X] T029 [P] Add E2E test for context limit on budget device in tests/e2e/ai-inference-low-ram.test.ts
  - Simulate 4GB RAM device with budget config (n_ctx=1024)
  - Send multiple messages to build up context
  - Verify inference still works at max context (~1K tokens)
  - App should degrade gracefully, not crash

- [X] T030 Add E2E test for memory pressure warning in tests/e2e/ai-inference-low-ram.test.ts
  - Simulate 4GB device with OS memory usage at 70%
  - Trigger inference
  - Verify MemoryMonitor detects pressure
  - Verify warning shown to user (optional: "Performance may be reduced")

---

## Phase 9: Performance Benchmarking

**Purpose**: Measure and validate optimization gains against targets

- [X] T031 [P] Create benchmark suite in tests/performance/runtime-optimization-benchmark.ts
  - Measure model load time (cold start) on each device tier
  - Measure TTFT (time-to-first-token) for 100-token generation
  - Measure throughput (tokens/sec) sustained
  - Measure peak memory during inference
  - Compare before/after for each tier

- [X] T032 [P] Add memory usage benchmarks in tests/performance/runtime-optimization-benchmark.ts
  - Measure RAM usage with use_mmap=true vs. false
  - Measure KV cache impact with f16 vs. q8_0 quantization
  - Measure impact of n_batch size (64 vs. 128 vs. 512)
  - Log comparative results to results.json

- [X] T033 Add crash rate statistical test in tests/performance/runtime-optimization-benchmark.ts
  - Run 100 inference iterations on simulated 4GB device
  - Count successful completions vs. OOM failures
  - Target: < 1% crash rate (verify against current ~35%)
  - Document results for product decision

---

## Phase 10: Documentation & Integration Verification

**Purpose**: Validate integration guide, update app context, finalize docs

- [ ] T034 Verify quickstart.md integration examples in docs/
  - Run each code example from quickstart.md (DeviceDetector, RuntimeConfigGenerator, MemoryMonitor usage)
  - Ensure examples are executable in app context
  - Update any deprecated imports or APIs

- [ ] T035 [P] Create device profile reference documentation in docs/runtime/device-profiles.md
  - Table of all three profiles with exact config values
  - Expectations per tier (latency, throughput, crash risk)
  - Model size recommendations per tier
  - Common issues and workarounds

- [ ] T036 [P] Create runtime optimization troubleshooting guide in docs/runtime/optimization-troubleshooting.md
  - FAQ from quickstart.md (converted to detailed guide)
  - How to override device classification (for testing)
  - How to check detected device info (logging)
  - How to interpret memory monitor warnings

- [ ] T037 Update GitHub Copilot context (.github/copilot-instructions.md)
  - Confirm TypeScript, llama.rn, React Native marked in context
  - Add device profile selection pattern as example workflow
  - Add memory monitoring pattern as example
  - Document constraint: no new web APIs (iOS/Android native only)

- [ ] T038 Add integration validation checklist in specs/001-optimize-runtime-planning/
  - Checklist: Device detection on iOS 14+, Android 8+
  - Checklist: Memory monitor responds to OS pressure
  - Checklist: Adaptive config reduces RAM by 40%+ on 4GB device
  - Checklist: Quality maintained (perplexity < 2% degradation)
  - Checklist: Fallback triggered on OOM

---

## Phase 11: Polish & Cleanup

**Purpose**: Final refinement and optional enhancements

- [ ] T039 Refactor AI

Runtime class for clarity in shared/ai/runtime.ts

- Break out service initialization into separate method
- Add clear comments on adaptive flow: detect → classify → generate → load
- Ensure error messages are user-friendly
- Add TODO comment if KV cache quantization requires Expo native wrapper

- [ ] T040 [P] Add TypeScript strict mode validation to shared/ai/
  - Ensure all services use strict types (no `any`)
  - Add type guards for optional fields (gpuMemoryMB?)
  - Validate all runtime configs against RuntimeConfig type

- [ ] T041 [P] Optimize imports and reduce bundle size in shared/ai/
  - Ensure lazy loading of device profiles (not all loaded at startup)
  - Mark MemoryMonitor as background service (non-critical import)
  - Consider code-splitting for device detection logic

- [ ] T042 Add device capability display to settings UI (optional enhancement)
  - Create Settings > Device Info screen showing detected tier
  - Show expected TTFT and tokens/sec from profile
  - Show current memory utilization from MemoryMonitor
  - Add "Force Tier Override" option for testing (debug-only)

- [ ] T043 Update README.md with optimization section
  - Explain three-tier profile strategy
  - Add performance expectations table
  - Link to research.md for technical details
  - Note: Optimization is transparent to users

- [ ] T044 [P] Run tests across all test suites
  - `npm test` → unit tests pass
  - `npm run test:integration` → integration tests pass
  - `npm run test:e2e` → E2E tests pass
  - Generate coverage report (target: 80%+ on Services)

---

## Phase 12: Final Validation & Merge Preparation

**Purpose**: Ensure all acceptance criteria met before merge

- [ ] T045 Validate against acceptance criteria from spec.md
  - ✅ Device detection works on iOS 14+ and Android 8+
  - ✅ Dynamic config reduces RAM by ≥ 40% on 4GB devices
  - ✅ Perplexity degradation < 2% with cache quantization
  - ✅ Inference latency unchanged or improved (p95 < 15s)
  - ✅ E2E tests pass on minimum target device (4GB simulation)
  - ✅ Documentation complete with integration examples
  - ✅ No regressions on high-RAM devices (8GB+)

- [ ] T046 Security review of device detection code
  - Ensure native API calls don't expose system info beyond what's necessary
  - Verify no data leaves device (all local processing)
  - Validate error handling in native wrappers

- [ ] T047 Performance audit: Measure optimizations vs. goals
  - Device load time: Compare baseline vs. optimized
  - RAM usage: Confirm 40-50% reduction on low-RAM tier
  - Crash rate: Confirm < 1% on 4GB device (vs. previous 35%)
  - Quality: Confirm perplexity loss < 2%

- [ ] T048 Create release notes for feature
  - Summary: "Runtime optimization enables 3GB+ device support"
  - Key benefits: "40% RAM reduction, 5-35% crash rate improvement"
  - Breaking changes: None (backward compatible)
  - Known limitations: "Requires llama.rn v0.11+ for KV quantization (workaround: Expo wrapper)"

- [ ] T049 Prepare PR and request review
  - Branch: `001-optimize-runtime-planning` → base: `main`
  - Title: "feat: Optimize llama.rn runtime for low-RAM devices"
  - Description: Link to spec.md, research.md, tasks.md
  - Tag: `@karlasouzza` for technical review
  - Tag: `@team` for product validation

- [ ] T050 Research: Measure baseline crash rate on 4GB devices
  - Collect existing telemetry or run 100-run benchmark on representative 4GB hardware or simulator
  - Record baseline crash rate and add measured value to `spec.md` (replace `X%`)
  - Add notes to `research.md` describing test method and devices used

- [ ] T051 Research: Create benchmark harness for perplexity & runtime
  - Define dataset (e.g., GSM8K subset + curated reflection prompts), seed, and metric scripts
  - Implement `tests/performance/benchmarks/harness.ts` that outputs perplexity, TTFT, tokens/sec, and peak memory
  - Validate harness on budget/mid/premium profiles and commit results to `tests/performance/results.json`

- [ ] T052 Consolidate canonical configs/examples in data-model.md
  - Move canonical runtime config examples (budget/mid/premium) to `data-model.md`
  - Update `quickstart.md` to reference `data-model.md` for canonical examples
  - Ensure `contracts/runtime-config.schema.json` remains the single source of truth for validation

---

## Dependencies & Execution Strategy

### Phase Dependencies (Strict Order)

1. **Phase 1** (Setup) — No dependencies
2. **Phase 2** (Foundational) — Depends on Phase 1 ✅ **Must complete before Phase 3+**
3. **Phase 3-4** (Implementation) — Depend on Phase 2
4. **Phase 5-9** (Testing, QA) — Depend on Phase 4
5. **Phase 10-12** (Docs, validation, merge) — Depend on Phase 9

### Parallel Opportunities Within Phases

**Phase 1** [All marked P can run in parallel]:

- T001, T002, T003 independent

**Phase 2** [All T004-T010, most marked P can run in parallel]:

- T005, T006, T008 can run in parallel (different files)
- T004, T007, T009, T010 have some dependencies (wait for T004 before T005)

**Phase 3** [T011-T012 can run in parallel]:

- Both work on cache quantization, minimal overlap

**Phase 5-9** [All test phases can run in parallel after Phase 4]:

- Unit tests (T017-T020) fully parallel
- Integration tests (T021-T027) parallel
- E2E tests (T028-T030) parallel
- Performance benchmarks (T031-T033) parallel

**Phase 11** [All optional enhancements can run in parallel]:

- T039-T043 independent

### Recommended Implementation Order

**For Solo Developer** (Sequential):

1. Phase 1 → Phase 2 → Phase 4 (core)
2. Phase 5 → Phase 6 (validation)
3. Phase 10 → Phase 12 (docs + merge)
4. Skip Phase 7-9 (optional if time-constrained)

**For Team of 2** (Parallelized):

- Developer 1: Phase 1 → Phase 2 (detector + generator)
- Developer 2: Wait for Phase 2 → Phase 4 (runtime integration)
- Both: Phase 5-12 in parallel

**For Team of 3+** (Full Parallelization):

- Stream 1: Phase 1, 2 (infrastructure)
- Stream 2: Phase 3, 4 (implementation) — start after Stream 1 ready
- Stream 3: Phase 5-7 (testing) — start after Stream 2 ready
- All: Phase 10-12 (docs/merge)

---

## Task Counts & Estimates

| Phase           | Tasks  | Parallelizable | Est. Days (Solo) |
| --------------- | ------ | -------------- | ---------------- |
| 1: Setup        | 3      | 2              | 1                |
| 2: Foundational | 7      | 4              | 2-3              |
| 3: KV Cache     | 2      | 1              | 0.5              |
| 4: Runtime      | 4      | 2              | 1                |
| 5: Unit Tests   | 4      | 3              | 1                |
| 6: Integration  | 4      | 3              | 1                |
| 7: Quality      | 3      | 2              | 0.5              |
| 8: E2E          | 3      | 2              | 1                |
| 9: Benchmarking | 3      | 2              | 1                |
| 10: Docs        | 5      | 3              | 1                |
| 11: Polish      | 6      | 4              | 1                |
| 12: Validation  | 5      | 1              | 1                |
| **TOTAL**       | **49** | **32 (65%)**   | **~11-12 days**  |

---

**Status**: ✅ All tasks generated from design documents (spec.md, plan.md, data-model.md, research.md, quickstart.md)

**Next Step**: Start Phase 1 tasks, or run `/speckit.implement` subagent to begin implementation automation.
