# Integration Validation Checklist
# Feature: Optimize llama.rn Runtime for Low-RAM Devices (001-optimize-runtime-planning)

## Device Detection

- [X] DeviceDetector.detect() returns valid DeviceInfo on Android 8+ (API 26+)
- [X] DeviceDetector.detect() returns valid DeviceInfo on iOS 14+
- [X] Available RAM calculation subtracts OS overhead (0.8 GB constant)
- [X] GPU detection returns hasGPU=true on iOS (Metal unified memory)
- [X] GPU detection falls back to 30% RAM heuristic on Android when Vulkan unavailable
- [X] Detection timestamp is recorded in DeviceInfo.detectionTimestamp
- [X] Detection method is recorded in DeviceInfo.detectionMethod

## Device Classification

- [X] Devices with < 5 GB available RAM classify as "budget"
- [X] Devices with 5–7 GB available RAM classify as "midRange"
- [X] Devices with ≥ 7 GB available RAM classify as "premium"
- [X] Classification uses availableRAM (not totalRAM)

## Runtime Configuration

- [X] Budget config: n_ctx=1024, n_batch=64, n_gpu_layers=0, cache_type_k=q8_0
- [X] Mid-range config: n_ctx=2048, n_batch=128, n_gpu_layers=50, cache_type_k=q8_0
- [X] Premium config: n_ctx=4096, n_batch=512, n_gpu_layers=99, cache_type_k=f16, use_mmap=false
- [X] n_threads is capped to actual CPU core count
- [X] n_gpu_layers is capped to 20 when GPU VRAM < 1000 MB
- [X] use_mlock=false on all tiers (mobile requirement)
- [X] All configs pass JSON Schema validation (contracts/runtime-config.schema.json)

## Memory Monitoring

- [X] MemoryMonitor.evaluate() returns MemoryPressure with all required fields
- [X] criticalLevel=true when utilizationPercent > 85%
- [X] canRunInference reflects available RAM vs. inference minimum
- [X] MemoryMonitor responds to OS memory pressure events via AppState
- [X] MemoryMonitor.configure() updates n_ctx and n_batch thresholds

## Adaptive Model Loading (AIRuntime)

- [X] AIRuntime.loadModel() auto-detects device and generates adaptive config
- [X] Tier selection is logged: "[AIRuntime] Selected tier: ..."
- [X] optionalOverrideConfig merges with auto-generated config
- [X] Startup RAM check logs warning if < 1.5 GB available
- [X] Config is stored in lastRuntimeConfig for OOM fallback

## OOM Fallback

- [X] streamCompletion() detects OOM errors and checks memory pressure
- [X] n_ctx is reduced by 50% on critical memory pressure (> 85% utilization)
- [X] Model is reloaded with degraded config before retry
- [X] Error message includes recommended max context tokens on final failure

## KV Cache Quantization

- [X] cache_type_k and cache_type_v are passed to llama.rn initLlama()
- [X] Validated values: "f16", "q8_0", "q4_0" — invalid values rejected
- [X] Budget and midRange tiers default to q8_0 (50% memory reduction)
- [X] Premium tier defaults to f16 (full precision)

## Quality

- [ ] Perplexity degradation with q8_0 KV cache < 2% vs. f16 baseline (requires model)
- [ ] Output is consistent across 3 runs with same seed on budget config (requires model)
- [ ] No obvious quantization artifacts (word repetition, nonsense) on 100-token prompt (requires model)

## Testing

- [X] Unit tests pass: 57 tests in tests/unit/
- [X] Integration tests pass: 41 tests in tests/integration/
- [X] Performance benchmarks pass: 17 tests in tests/performance/
- [X] E2E memory pressure scenarios pass: 3 tests in tests/e2e/
- [ ] E2E full model inference (requires MODEL_PATH env var)

## Documentation

- [X] quickstart.md provides accurate, executable examples
- [X] docs/runtime/device-profiles.md created
- [X] docs/runtime/optimization-troubleshooting.md created
- [X] .github/copilot-instructions.md updated with service patterns
- [X] README.md updated with optimization section

## Regression

- [X] AIRuntime.streamCompletion() public API unchanged
- [X] ChatMessage, CompletionOutput types unchanged
- [X] Premium 8 GB device inference unchanged (tier selected transparently)
