# Feature Specification: Simplify and Adjust @shared for Precision

**Feature Branch**: `005-simplify-shared`  
**Created**: 2026-04-16  
**Status**: Draft  
**Input**: Simplify and adjust @shared device detection and AI runtime for precision, using review.md analysis

## Clarifications

### Session 2026-04-16

- Q: How should the system detect and validate the Android version when deciding between Vulkan and OpenCL? → A: Option C — Accept `osVersion` as an optional parameter via DI; if provided use it to prefer Vulkan on modern Snapdragon (Android 13+), otherwise fallback defensively to OpenCL. If Vulkan attempt fails at runtime, fall back to OpenCL.

- Q2: SHA256 verification source → DEFERRED by user (do not focus now). Default: continue with planning but postpone concrete choice; prefer per-model manifest + signature later when implementing.

- Q3: GPU fallback behavior → A: Option C — Attempt to initialize the GPU backend at runtime (probe). Implementation notes: the runtime should attempt to initialize the preferred backend (Vulkan on Android, Metal on iOS) with a short timeout and isolated error handling. If initialization fails or errors occur, set `hasGPU: false` and fall back to CPU execution; record the failure reason for telemetry and diagnostics. Probing should be idempotent and safe to run as part of `detectCapabilities` or during `AIRuntime` initialization.

- Q4: KV cache quantization impact → A: Option C — Use model metadata when available. Implementation: call `await loadLlamaModelInfo(modelPath)` to obtain model size, quantization type, context window, and cache parameters; compute precise memory budget from that data. If metadata is missing or the call fails, fall back to the conservative estimation in FR-005.

### Session 2026-04-17

- Q: Memory budget formula derivation → A: Option A — Keep the precise formula (Model Weights + KV Cache + Working 15% + Overhead 0.5GB) and add an explicit derivation, units (bytes vs GiB), and worked numeric examples/test vectors (7B with 2048 context; 13B illustrative) to make implementations and tests unambiguous.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Device Capabilities Detection is Reliable and Accurate (Priority: P1)

Developers using the device detection system need accurate information about available RAM and GPU capabilities to make confident decisions about which AI models can run on the user's device without risk of out-of-memory crashes or unexpected termination.

**Why this priority**: This is the foundation of the entire feature. Incorrect device capability detection leads to app crashes, poor user experience, and data loss. This is the most critical improvement.

**Independent Test**: Can be fully tested by detecting a device's capabilities and verifying that available RAM calculations match real usage patterns, and that models load successfully when the calculation says they will fit.

**Acceptance Scenarios**:

1. **Given** a device with 6GB total RAM and 3.5GB currently available, **When** system detects capabilities, **Then** it calculates available RAM as approximately 1.5GB (after OS overhead), not 2.7GB (incorrect assumption)
2. **Given** an iOS device, **When** system calculates OS overhead, **Then** it reserves 1.5GB, aligned with real iOS behavior
3. **Given** an Android device, **When** system calculates OS overhead, **Then** it reserves 2GB, aligned with real Android behavior
4. **Given** a model that requires 5GB of RAM (weights + KV cache + working memory), **When** available RAM is less than required, **Then** system prevents loading and provides clear feedback to user

---

### User Story 2 - GPU Acceleration Works Reliably Across Different Chipsets (Priority: P1)

Users with modern Android devices expect GPU acceleration to work without crashes, particularly on newer Snapdragon processors that benefit from Vulkan backend instead of outdated OpenCL.

**Why this priority**: Current implementation forces all Adreno GPUs to use OpenCL, which crashes on newer Snapdragon 8 Gen 2+ devices. Flash Attention is also enabled on Android without validation, causing crashes on Adreno. This blocks the entire feature on modern Android devices.

**Independent Test**: Can be fully tested by loading a model on modern Snapdragon devices and verifying that GPU acceleration works without crashing or hanging.

**Acceptance Scenarios**:

1. **Given** a Snapdragon 8 Gen 2 device running Android 13+, **When** system detects GPU capabilities, **Then** it selects Vulkan backend, not OpenCL
2. **Given** any Android device, **When** system configures Flash Attention, **Then** it is disabled (not enabled based on hasGPU alone)
3. **Given** an iOS device with Metal GPU, **When** system configures Flash Attention, **Then** it is enabled with `flash_attn: true` and `flash_attn_type: "on"`
4. **Given** a device with GPU but less than 1GB available RAM, **When** system detects capabilities, **Then** it sets `hasGPU: false` to prevent out-of-memory scenarios

---

### User Story 3 - Memory Budget Calculation Prevents Out-of-Memory Crashes (Priority: P1)

Developers using the model loading system need precise calculation of how much RAM a model requires so that pre-flight checks can prevent loading models that will crash the app.

**Why this priority**: Current memory budget is "too simplistic" (heuristic bytesPerToken). This leads to crashes when users try to load models that appear to fit but actually require more memory due to KV cache and working activations.

**Independent Test**: Can be fully tested by calculating required memory for different model sizes and context lengths, then verifying that a model loading succeeds when pre-flight check passes.

**Acceptance Scenarios**:

1. **Given** a 7B parameter model (quantized to ~4GB file size) with 2048 context window, **When** system calculates required RAM, **Then** it accounts for KV cache (additional ~2-3GB) and working memory (15% overhead) for accurate total
2. **Given** insufficient RAM detected before loading, **When** user attempts to load model, **Then** system shows clear message: "RAM insufficient: X.XGB available, Y.YGB required"
3. **Given** a model loading with valid available RAM, **When** model completes loading, **Then** OOM detection during generation does not trigger (no false positives)

---

### User Story 4 - CPU Detection is Simplified and Focused (Priority: P2)

Developers need CPU core information for threading decisions without unnecessary complexity that provides false precision and adds maintenance burden.

**Why this priority**: Current CPU detection includes brand-specific performance core ratios (Snapdragon 0.375 vs Apple 0.5) that have marginal practical impact. Simplifying reduces complexity without affecting runtime decisions.

**Independent Test**: Can be tested by verifying that CPU core count is correctly reported and that n_threads parameter for llama.cpp uses the correct value (capped at 8).

**Acceptance Scenarios**:

1. **Given** a device with 8 CPU cores, **When** system detects CPU capabilities, **Then** it reports `cpuCores: 8` and uses 8 for n_threads (practical limit for llama.cpp)
2. **Given** a device with 12 CPU cores, **When** system detects CPU capabilities, **Then** it reports `cpuCores: 12` but caps n_threads at 8 (llama.cpp practical limit)
3. **Given** CPU detection, **When** system builds runtime config, **Then** it does NOT attempt to calculate performance core ratio by brand

---

### User Story 5 - Model Integrity is Verified and App Stability is Protected (Priority: P2)

Users need assurance that downloaded models are not corrupted and that app stability is protected during model loading transitions.

**Why this priority**: Current implementation downloads models but does not verify SHA256 hash post-download, creating risk of corrupted model usage. This is important for data integrity but less critical than fixing memory detection.

**Independent Test**: Can be tested by verifying that a model with known SHA256 hash is verified correctly after download.

**Acceptance Scenarios**:

1. **Given** a model is downloaded, **When** download completes, **Then** system calculates SHA256 and compares to expected value
2. **Given** a corrupted model file, **When** hash verification runs, **Then** system rejects the model and allows retry
3. **Given** a model load in progress, **When** user navigates away or app enters background, **Then** state is preserved and load continues or restarts cleanly

---

### Edge Cases

- What happens when a device's available RAM is below 1GB total?
- How does the system behave when OS overhead calculation results in negative available RAM?
- What happens on Android devices older than Android 13 when trying to use Vulkan?
- How should the system handle devices where GPU vendor cannot be detected?
- What happens when a model requires more memory than the device's total RAM?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST calculate available RAM by subtracting OS overhead (1.5GB iOS, 2GB Android) and current usage from total RAM
- **FR-002**: System MUST detect GPU backend correctly: Metal for iOS; for Android, the system MUST accept `osVersion` as an optional parameter (via DI). If `osVersion` indicates Android 13+ and brand indicates a modern Snapdragon, prefer Vulkan; otherwise default to OpenCL. If `osVersion` is unavailable, the system MUST defensively fall back to OpenCL.
- **FR-003**: System MUST set `hasGPU: false` if available RAM is less than 1GB, even if GPU hardware is detected
- **FR-004**: System MUST disable Flash Attention on Android (`flash_attn: false`) and enable only on iOS with Metal backend (`flash_attn: true`)

Implementation note: the runtime MUST set both a boolean and a typed mode for clarity:

- `flash_attn` (boolean): set to `deviceInfo.platform === 'ios' && deviceInfo.hasGPU`
- `flash_attn_type` ("on" | "auto" | "off"): set to `deviceInfo.platform === 'ios' ? "on" : "off"` (implementations may use "auto" for future heuristics)
- **FR-005**: System MUST calculate memory budget as: Model Weights + KV Cache (2 × 32 × context_size × 4096 × 2 bytes in f16) + Working Activations (15% of model size) + Overhead (0.5GB). When available, the system SHOULD use model metadata returned by `await loadLlamaModelInfo(modelPath)` (quantization, context, cache parameters, model size) to compute the budget accurately; otherwise fall back to the conservative formula above.
- **FR-006**: System MUST implement pre-flight memory check before loading a model, comparing calculated required memory against available RAM
- **FR-007**: System MUST reject model loading with clear user-facing message if required RAM exceeds available RAM
- **FR-008**: System MUST report CPU core count (actual count, capped at 8 for llama.cpp practical limit) without attempting to calculate performance core ratios by brand
- **FR-009**: System MUST verify model integrity via SHA256 hash comparison after download
- **FR-010**: System MUST provide accurate available RAM value to all consumers (device profile selection, memory monitor, model loader)
- **FR-011**: System MUST remove or make optional: cpuBrand detection, performanceCoreRatio calculation, gpuMemoryMB estimation without verified native API
- **FR-012**: System MUST maintain deviceModel and osVersion for logging/debug only, not for runtime decisions
- **FR-013**: Memory evaluation via MemoryMonitor MUST detect critical pressure (>85% utilization) and trigger appropriate warnings or fallback behavior

## Constraints _(mandatory)_

- **C-001**: All commits, inline comments, and documentation MUST be written in English.
- **C-002**: All user-facing text (UI strings, labels, helper text) MUST be in Brazilian Portuguese (pt-BR).
- **C-003**: UI and feature implementation MUST favor small, composable micro-components and micro-logics (single responsibility). Large components require documented justification.
- **C-004**: Dependency Injection pattern MUST be used: no direct native API calls in components, all accessed through DI interfaces (IDeviceInfoProvider, IPlatformProvider, IMemoryInfoProvider)
- **C-005**: React Native imports MUST NOT appear in test files (bun:test cannot parse Flow import typeof syntax)

### Key Entities

- **DeviceInfo**: Represents detected device capabilities (totalRAM, availableRAM, cpuCores, hasGPU, gpuBackend, platform, detectedAt)
- **GpuProfile**: Represents GPU acceleration configuration (type, backend, vramFraction)
- **RuntimeConfig**: Represents generated llama.cpp runtime configuration with all parameters for model loading
- **MemoryPressure**: Represents current memory utilization metrics (availableRAM, usedRAM, pressurePercentage, criticalLevel)
- **ModelMetadata**: Represents model information including fileSizeBytes, requiredRAM, sha256Hash, contextWindow

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Models that fit within available RAM load successfully on first attempt (95% success rate on real devices with sufficient RAM)
- **SC-002**: Models that exceed available RAM are rejected before loading with clear user message (100% of cases)
- **SC-003**: App does not crash due to out-of-memory during model loading or generation (zero OOM crashes)
- **SC-004**: GPU acceleration works on modern Snapdragon devices (Snapdragon 8 Gen 2+) without crashes (100% stability)
- **SC-005**: Flash Attention does not cause crashes on Android devices (zero Flash Attention related crashes)
- **SC-006**: Available RAM calculation accuracy is within ±500MB of actual usable memory on devices with 4-8GB total RAM
- **SC-007**: Model integrity verification prevents corrupted models from being used (100% verification accuracy)
- **SC-008**: CPU detection reports actual core count without false precision, allowing n_threads selection to work correctly (zero misconfigurations)

## Assumptions

- RAM overhead of 1.5GB for iOS and 2GB for Android matches real-world behavior based on technical documentation and industry standards
- Vulkan backend is stable on Snapdragon 8 Gen 2+ with Android 13+, and OpenCL is legacy/deprecated for modern devices
- Flash Attention is currently unstable on Adreno GPU (per technical article warnings) and should be disabled pending further validation
- KV cache quantization will be handled separately (f16, q8_0, q4_0 options already implemented)
- Device model information can be used for logging/debugging without impacting correctness of runtime decisions
- `llama.cpp` uses threads effectively up to 8 cores, and additional cores beyond 8 don't improve performance proportionally
- All model files are stored locally after download with persistent access (no iCloud backup issues in v1)
- Background memory monitoring (AppState listeners) will handle edge cases of model loading during background transitions
- Singleton `AIRuntime` service pattern is correct and will be maintained
- MemoryMonitor's critical pressure threshold of 85% is appropriate for triggering warnings
