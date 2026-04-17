# Research Output: Device Detection & Memory Management Precision

**Phase**: 0 - Outline & Research  
**Status**: Complete (all clarifications resolved)  
**Consolidated From**: Feature Spec Clarifications (Session 2026-04-16)

## 1. Android GPU Backend Selection (Vulkan vs OpenCL)

**Unknown**: How should the system detect and validate the Android version when deciding between Vulkan and OpenCL?

**Decision**: Accept `osVersion` as an optional parameter via Dependency Injection. If provided:

- On Android 13+ with modern Snapdragon (detected via brand), prefer Vulkan backend
- Otherwise, defensively fall back to OpenCL
- If Vulkan initialization fails at runtime, fall back to OpenCL with error logging

**Rationale**:

- Vulkan is the modern standard for Android 13+ but requires careful runtime validation
- OpenCL is legacy but stable on older devices
- Defensive fallback prevents app crashes on devices where Vulkan is unavailable
- DI pattern allows testing without real device-specific behavior

**Alternatives Considered**:

- Force all devices to use OpenCL (too conservative, misses Snapdragon 8 Gen 2+ optimization)
- Detect version from native code (violates DI constraint; harder to test)

**Implementation Artifacts**:

- Update `DeviceDetector` to accept optional `osVersion` parameter
- Implement `selectGpuBackend(osVersion, gpuBrand)` logic in runtime-config-generator.ts
- Add runtime GPU initialization probe with error recovery

---

## 2. GPU Fallback Behavior & Probing Strategy

**Unknown**: Should GPU backend selection happen at static config time or via runtime probing?

**Decision**: Option C - Attempt to initialize the GPU backend at runtime (probe):

- System attempts to initialize preferred backend (Vulkan on Android, Metal on iOS)
- Use a short timeout (~500ms) with isolated error handling
- On failure, set `hasGPU: false` and fall back to CPU
- Record failure reason for telemetry and diagnostics

**Rationale**:

- Static config cannot account for driver crashes or initialization failures
- Runtime probing catches real-world issues (e.g., missing Vulkan drivers)
- Idempotent and safe to run during `detectCapabilities()` or `AIRuntime` initialization
- Provides accurate telemetry on why GPU acceleration failed

**Alternatives Considered**:

- Static config only (misses runtime failures)
- Always attempt GPU with no fallback (crashes app on some devices)

**Implementation Artifacts**:

- Add `probeGpuBackend()` async method to DeviceDetector or AIRuntime
- Implement timeout-safe initialization check
- Log failure reason for diagnostics

---

## 3. KV Cache Quantization & Memory Budget Accuracy

**Unknown**: How should KV cache quantization impact be calculated?

**Decision**: Option C - Use model metadata when available:

1. Call `await loadLlamaModelInfo(modelPath)` to obtain:
   - Model file size (bytes)
   - Quantization type (f16, q8_0, q4_0, etc.)
   - Context window (tokens)
   - Cache parameters (n_ctx, n_batch)
2. Compute precise memory budget from metadata
3. If metadata missing or call fails, fall back to conservative estimation formula

**Rationale**:

- Model metadata provides the most accurate information for memory budgeting
- Handles all quantization types without hardcoding assumptions
- Conservative fallback prevents underestimation but may overestimate
- Aligns with existing `loadLlamaModelInfo()` utility

**Alternatives Considered**:

- Always use conservative formula (less accurate, may reject loadable models)
- Hardcode quantization assumptions (brittle, breaks with new quant types)

**Implementation Artifacts**:

- Integrate `loadLlamaModelInfo()` call into memory budget calculation
- Update `calculateMemoryBudget(modelPath, osVersion)` to use metadata when available
- Implement fallback formula: Model Weights + KV Cache + Working Memory (15%) + Overhead (0.5GB)

---

## 4. Model Integrity Verification (SHA256)

**Unknown**: Should SHA256 verification source be per-model manifest or centralized?

**Decision**: DEFERRED (per user) - Default to continue planning but postpone concrete choice. Prefer per-model manifest + signature later when implementing. For Phase 0, assume:

- SHA256 hash is available (from download metadata or model manifest)
- Implementation focuses on post-download verification workflow
- Future enhancement: sign manifests for additional security

**Rationale**:

- Per-model manifest is most flexible for future updates
- Centralized registry may become bottleneck
- Deferring allows feature to proceed without blocking on infrastructure choice

**Implementation Artifacts**:

- Add `verifyModelIntegrity(filePath, expectedHash)` to model-loader.ts
- Calculate SHA256 post-download
- Compare against expected value; reject if mismatch
- Retry mechanism for corrupted downloads

---

## 5. Flash Attention Configuration

**Unknown**: Should Flash Attention be enabled on Android with GPU?

**Decision**: Disable Flash Attention on all Android devices; enable only on iOS with Metal backend.

**Rationale**:

- Flash Attention is unstable on Adreno GPU (per technical warnings)
- Causes crashes on Android devices even with GPU available
- Metal on iOS is stable for Flash Attention
- Disable by setting `flash_attn: false` on Android

**Implementation**:

- Update `RuntimeConfigGenerator.generateRuntimeConfig()` to set:
  - Android: `flash_attn: false`
  - iOS: `flash_attn: true` (only if Metal GPU detected)

---

## 6. Memory Budget Formula (Conservative Baseline)

**Unknown**: What is the accurate formula for memory budget calculation?

**Decision**: Use two-tier approach:

1. **Preferred (if model metadata available)**:
   - Weights Size + KV Cache (2 × 32 × context_size × 4096 × 2 bytes in f16) + Working Activations (15% of weights) + Overhead (0.5GB)
2. **Fallback (if metadata unavailable)**:
   - Same formula with conservative context_size estimate (1024 tokens default)

**Rationale**:

- Matches llama.cpp actual memory usage patterns
- KV cache formula accounts for all attention heads (32) and head dimension (4096)
- 15% working activation overhead aligns with transformer inference characteristics
- 0.5GB overhead accounts for framework, buffers, and OS overhead

**Testing Notes**:

- Verify accuracy on 4GB and 8GB devices with known models
- Target: ±500MB accuracy on calculated vs. actual memory

---

## 7. CPU Detection Simplification

**Unknown**: Should CPU detection include brand-specific performance core ratios?

**Decision**: Remove brand-specific performance core ratio calculations. Report actual core count only:

- Report `cpuCores` as detected count (not adjusted by brand)
- Cap `n_threads` at 8 for llama.cpp practical limit (not brand-specific)
- Remove `performanceCoreRatio` calculation entirely
- Optionally retain `cpuBrand` for logging/debug only (not for decisions)

**Rationale**:

- Performance core ratio (Snapdragon 0.375, Apple 0.5) adds minimal practical impact
- Simplifies code and maintenance burden
- llama.cpp caps thread utility at ~8 cores regardless of brand
- Actual core count sufficient for threading decisions

**Implementation**:

- Update DeviceDetector to report raw `cpuCores`
- Remove `performanceCoreRatio` calculation
- Cap `n_threads = Math.min(cpuCores, 8)`

---

## 8. OS Overhead & Available RAM Calculation

**Unknown**: What are realistic OS overhead values for available RAM calculation?

**Decision**: Use platform-specific constants:

- **iOS**: 1.5GB overhead (based on iOS memory management and real-world measurements)
- **Android**: 2GB overhead (based on Android processes and system services)

**Formula**: `availableRAM = totalRAM - osOverhead - currentUsageRAM`

**Rationale**:

- iOS is more memory-efficient with managed memory model
- Android reserves more for system services and background processes
- Values match industry standards and real-world behavior
- Conservative estimates prevent underestimation

**Testing**: Verify on real devices that calculated available RAM matches actual usable memory (target: ±500MB)

---

## 9. GPU Memory Estimation Removal

**Unknown**: Should `gpuMemoryMB` field be retained?

**Decision**: Remove `gpuMemoryMB` estimation from DeviceInfo. Rationale:

- No reliable way to detect dedicated GPU VRAM on mobile devices
- llama.rn manages GPU memory allocation internally
- Previous estimation was false precision (not used in practice)
- VRAM fraction should be derived from available system RAM and device tier

**Implementation**:

- Remove `gpuMemoryMB` from DeviceInfo type
- Keep `hasGPU` and `gpuBackend` flags
- Allow llama.rn to manage GPU memory allocation

---

## 10. Device Model & OS Version for Logging

**Unknown**: Should deviceModel and osVersion be used for runtime decisions?

**Decision**: Retain deviceModel and osVersion for logging/debug only. Not for runtime decisions.

**Rationale**:

- Useful for telemetry, debugging, and reproduction of issues
- Device model should not drive decisions (too many variants)
- OS version used only for Vulkan/OpenCL decision (Android 13+ preference)
- Keeps runtime decisions data-driven (RAM, GPU, CPU) not device-specific

---

## Summary of Design Decisions

| Area                  | Decision                                               | Key Artifact                                        |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| GPU Backend (Android) | Vulkan on Android 13+ Snapdragon, OpenCL fallback      | `selectGpuBackend()` in runtime-config-generator.ts |
| GPU Probing           | Runtime probe with fallback to CPU                     | `probeGpuBackend()` async method                    |
| Memory Budget         | Use model metadata when available, fallback to formula | `calculateMemoryBudget()` with metadata lookup      |
| Model Integrity       | Post-download SHA256 verification                      | `verifyModelIntegrity()` in model-loader.ts         |
| Flash Attention       | Disabled on Android, enabled on iOS Metal              | Config flags in RuntimeConfig                       |
| CPU Detection         | Raw core count, cap n_threads at 8, remove ratios      | Remove `performanceCoreRatio`, keep `cpuCores`      |
| OS Overhead           | 1.5GB iOS, 2GB Android                                 | Used in `calculateAvailableRAM()`                   |
| GPU Memory            | Remove `gpuMemoryMB` estimation                        | Delegate to llama.rn                                |
| Device Info Usage     | Log/debug only, not for decisions                      | Retain in diagnostics                               |

---

## Open Questions (Deferred or Resolved)

- ✅ Android GPU backend selection → RESOLVED (Vulkan on Android 13+ Snapdragon)
- ✅ GPU fallback behavior → RESOLVED (runtime probe with CPU fallback)
- ✅ KV cache quantization → RESOLVED (use metadata when available)
- ⏳ SHA256 source → DEFERRED (prefer per-model manifest later)
- ✅ Flash Attention → RESOLVED (disabled on Android)
- ✅ Memory formula → RESOLVED (metadata + fallback formula)
- ✅ CPU detection → RESOLVED (raw count, cap at 8)
