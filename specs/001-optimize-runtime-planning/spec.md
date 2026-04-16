# Feature Specification: Optimize llama.rn Runtime for Low-RAM Devices

**Feature ID**: 001-optimize-runtime-planning  
**Status**: Specification  
**Author**: AI Runtime Optimization Team  
**Date**: 2026-04-15

## Overview

This specification defines the technical basis for optimizing the `llama.rn` runtime to support low-RAM Android and iOS devices while maintaining inference quality and performance.

## Problem Statement

Current runtime configuration (`n_ctx: 4096`, `n_gpu_layers: 99`, `use_mlock: true`) causes:

- High memory consumption during model loading (near 100% of model size)
- Out-of-Memory (OOM) crashes on devices with < 6GB RAM
- System termination due to mlock preventing OS memory management
- Suboptimal KV cache memory usage during inference
- Excessive thread contention and poor mobile latency

**Impact**:

- Users on mid-range devices (4-6GB RAM) experience app crashes
- Cold start time inflated by aggressive locking strategies
- Inference latency on older devices exceeds acceptable thresholds

## Success Criteria

| Metric                   | Current             | Target               | Acceptance                  |
| ------------------------ | ------------------- | -------------------- | --------------------------- |
| RAM on model load        | ~100% of model size | 40-60% of model size | -50%                        |
| RAM during inference     | 2-3x model size     | 1.5-2x model size    | -50%                        |
| Tokens/second throughput | Baseline            | +20-50%              | Measurable gain             |
| Model load time (7B)     | Baseline            | < 5 seconds          | Acceptable UX               |
| Crash rate on 4GB RAM    | X%                  | < 1%                 | Reliability                 |
| KV cache memory overhead | Unquantized         | -50% via q8_0        | Quality + Memory            |
| Device support ceiling   | 6GB+ RAM            | 3GB+ RAM             | Expanded addressable market |

## Scope

### In Scope

1. **Dynamic Configuration**: Runtime parameters adapted to detected device capabilities (Android-focused; iOS secondary)
2. **Memory Mapping (mmap)**: Lazy loading of model weights
3. **KV Cache Quantization**: q8_0 quantization for key/value tensors (< 2% perplexity loss validation required)
4. **Dynamic Batch Sizing**: Context-aware `n_batch` and `n_ubatch` configuration
5. **GPU Layer Management**: Intelligent fallback to CPU when VRAM insufficient
6. **Device Detection**: RAM, CPU cores, VRAM capability detection (Android priority)
7. **Quality Gates**: Benchmarking perplexity (< 2%) and task accuracy degradation

### Out of Scope

- Model architecture changes (stays with llama.cpp-compatible models)
- Migration to different inference engines
- Web platform optimization (iOS/Android native only)
- User-facing feature additions (optimization only)

## Technical Approach

### Phase 1: Configuration Optimization

- Implement dynamic context size based on detected RAM availability
- Reduce batch sizes for mobile (64-128 vs. 512)
- Enable `use_mmap: true` for streaming weight loading
- Disable `use_mlock` on mobile platforms
- Implement device capability detection (RAM, CPU cores, VRAM)

### Phase 2: KV Cache Optimization

- Add `cache_type_k: 'q8_0'` and `cache_type_v: 'q8_0'` parameters
- Validate perplexity degradation (target: < 2%)
- Implement asymmetric cache quantization (K8V4) for additional savings
- Add cache statistics monitoring

### Phase 3: Memory Management

- Implement proactive memory monitoring
- Add model unload/reload on background transitions
- Implement system memory pressure callbacks
- Add OOM recovery mechanisms

### Phase 4: Performance Validation

- Benchmark on target devices (4GB, 6GB, 8GB RAM variants)
- Validate inference latency (p95 < 15s per reflection)
- Measure quality degradation across quantization levels
- Validate on GSM8K, reasoning tasks

### Phase 5: Integration & Testing

- Unit tests for device detection logic
- Integration tests for model loading with various configurations
- E2E tests for inference quality validation
- Stress tests for memory stability over time

## Dependencies

### Technology Stack

- **Language**: TypeScript (React Native)
- **Inference Engine**: llama.rn (llama.cpp bindings)
- **Platform**: React Native + Expo Router
- **Testing**: Bun test runner
- **Performance Monitoring**: Native memory APIs (iOS: os_proc_available_memory, Android: ActivityManager.MemoryInfo)

### External Dependencies

- `llama.rn` with cache quantization support (verify version support)
- React Native platform-specific APIs for device detection
- Native memory monitoring APIs

### Known Constraints

1. **Cache quantization support**: Requires llama.cpp >= v2501 with cache quantization flag support
2. **Platform limitations**: iOS may not expose VRAM info; Android detection via EGL/Vulkan
3. **Backward compatibility**: Existing cached models may be invalidated by configuration changes
4. **Cache invalidation**: KV cache format changes require model reload

## Open Questions (NEEDS CLARIFICATION)

1. **llama.rn version compatibility**: Does current llama.rn version support `cache_type_k` and `cache_type_v` parameters?
2. **GPU detection accuracy**: How reliable is VRAM detection on Android via EGL/Vulkan? Fallback strategy?
3. **Acceptable perplexity degradation**: Resolved — Perplexity degradation threshold set to < 2% (accepted).
4. **Device baseline**: What is the minimum target device? (e.g., iPhone 11, Pixel 4a)
5. **Model cache invalidation**: How should we handle users with pre-cached models when config changes?
6. **Fallback behavior**: Should inference still proceed on OOM with degraded quality, or fail gracefully?

## Clarifications

### Session 2026-04-15

- Q: Is 2% perplexity loss acceptable? → A: <2% (accepted).
- Q: Test tooling conflict (Jest vs Bun) → A: Migrate tests to Bun (`bun test`).
- Q: llama.rn cache quantization support → A: Update `llama.rn` to latest version (upgrade + verify).
- Q: Baseline crash rate placeholder `X%` → A: Baseline will be measured (added task T046).
- Q: Cold start scope ambiguity → A: Refined to "AI model cold start" (see updated plan).
- Q: "Dismatic" term → A: Corrected to "Dynamic Batch Sizing".
- Q: Documentation duplication → A: Consolidate canonical configs/examples in `data-model.md` (task T048).

## Non-Functional Requirements

### Performance

- Model load latency: < 5 seconds (7B model on 4GB RAM device via mmap)
- Inference latency p95: < 15 seconds per reflection (current baseline)
- Throughput: Maintain or improve tokens/second

### Memory

- Cold start memory: ≤ 60% of model size via mmap
- Inference memory: ≤ 2x model size during active generation
- Stable memory over time (no leaks during long sessions)

### Reliability

- < 1% crash rate on 4GB RAM devices (vs. current X%)
- Graceful degradation when memory pressure detected
- Automatic recovery from transient OOM

### Quality

- Perplexity degradation: < 2% with q8_0 cache quantization (validated on Llama 2-7B, Llama 3-8B)
- Task accuracy loss: < 3% on GSM8K (benchmark) with Q4_K_M model quantization
- Reasoning quality: Maintained or improved (no degradation vs. FP16 baseline)

### Constraints

- Must support iOS 14+ and Android 8+
- No new external dependencies (network, cloud services)
- Local-only processing (privacy requirement)
- Encrypted data at rest (existing MMKV integration)

## Deliverables

1. **research.md**: Technology evaluation and best practices synthesis
2. **data-model.md**: Runtime configuration schema and device detection models
3. **contracts/runtime-config.json**: JSON schema for runtime parameters
4. **quickstart.md**: Integration guide for application developers
5. **Implementation tasks** (generated by speckit.tasks)
6. **Performance benchmarks**: Measured latency, memory, quality metrics
7. **Test coverage**: Unit, integration, E2E test suite (80%+ coverage)

## Acceptance Criteria

- [ ] All NEEDS CLARIFICATION items resolved in research.md
- [ ] Device detection works on iOS 14+ and Android 8+
- [ ] Dynamic configuration reduces RAM by ≥40% on 4GB devices
- [ ] Perplexity degradation < 2% with cache quantization
- [ ] Inference latency unchanged or improved (p95 < 15s)
- [ ] E2E tests pass on minimum target device
- [ ] Documentation complete with integration examples
- [ ] No regressions in quality or performance on high-RAM devices

## References

- **Source Document**: optmize-runtime.md (provided)
- **Base Technology**: llama.cpp (https://github.com/ggerganov/llama.cpp)
- **Relevant Issues**: [Link to GitHub issues if applicable]
- **Related Specs**: [Link to related feature specs]

---

**Next Step**: Run `/speckit.plan` to generate research.md, data-model.md, and implementation plan.
