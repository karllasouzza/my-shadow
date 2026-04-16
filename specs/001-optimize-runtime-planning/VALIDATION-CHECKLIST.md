# Integration Validation Checklist

# Feature: Optimize llama.rn Runtime for Low-RAM Devices (001-optimize-runtime-planning)

## Device Detection

- [x] DeviceDetector.detect() returns valid DeviceInfo on Android 8+ (API 26+)
- [x] DeviceDetector.detect() returns valid DeviceInfo on iOS 14+
- [x] Available RAM calculation subtracts OS overhead (0.8 GB constant)
- [x] GPU detection returns hasGPU=true on iOS (Metal unified memory)
- [x] GPU detection falls back to 30% RAM heuristic on Android when Vulkan unavailable
- [x] Detection timestamp is recorded in DeviceInfo.detectionTimestamp
- [x] Detection method is recorded in DeviceInfo.detectionMethod

## Device Classification

- [x] Devices with < 5 GB available RAM classify as "budget"
- [x] Devices with 5–7 GB available RAM classify as "midRange"
- [x] Devices with ≥ 7 GB available RAM classify as "premium"
- [x] Classification uses availableRAM (not totalRAM)

## Runtime Configuration

- [x] Budget config: n_ctx=1024, n_batch=64, n_gpu_layers=0, cache_type_k=q8_0
- [x] Mid-range config: n_ctx=2048, n_batch=128, n_gpu_layers=50, cache_type_k=q8_0
- [x] Premium config: n_ctx=4096, n_batch=512, n_gpu_layers=99, cache_type_k=f16, use_mmap=false
- [x] n_threads is capped to actual CPU core count
- [x] n_gpu_layers is capped to 20 when GPU VRAM < 1000 MB
- [x] use_mlock=false on all tiers (mobile requirement)
- [x] All configs pass JSON Schema validation (contracts/runtime-config.schema.json)

## Memory Monitoring

- [x] MemoryMonitor.evaluate() returns MemoryPressure with all required fields
- [x] criticalLevel=true when utilizationPercent > 85%
- [x] canRunInference reflects available RAM vs. inference minimum
- [x] MemoryMonitor responds to OS memory pressure events via AppState
- [x] MemoryMonitor.configure() updates n_ctx and n_batch thresholds

## Adaptive Model Loading (AIRuntime)

- [x] AIRuntime.loadModel() auto-detects device and generates adaptive config
- [x] Tier selection is logged: "[AIRuntime] Selected tier: ..."
- [x] optionalOverrideConfig merges with auto-generated config
- [x] Startup RAM check logs warning if < 1.5 GB available
- [x] Config is stored in lastRuntimeConfig for OOM fallback

## OOM Fallback

- [x] streamCompletion() detects OOM errors and checks memory pressure
- [x] n_ctx is reduced by 50% on critical memory pressure (> 85% utilization)
- [x] Model is reloaded with degraded config before retry
- [x] Error message includes recommended max context tokens on final failure

## KV Cache Quantization

- [x] cache_type_k and cache_type_v are passed to llama.rn initLlama()
- [x] Validated values: "f16", "q8_0", "q4_0" — invalid values rejected
- [x] Budget and midRange tiers default to q8_0 (50% memory reduction)
- [x] Premium tier defaults to f16 (full precision)

## Quality

- [ ] Perplexity degradation with q8_0 KV cache < 2% vs. f16 baseline (requires model)
- [ ] Output is consistent across 3 runs with same seed on budget config (requires model)
- [ ] No obvious quantization artifacts (word repetition, nonsense) on 100-token prompt (requires model)

## Testing

- [x] Unit tests pass: 57 tests in tests/unit/
- [x] Integration tests pass: 41 tests in tests/integration/
- [x] Performance benchmarks pass: 17 tests in tests/performance/
- [x] E2E memory pressure scenarios pass: 3 tests in tests/e2e/
- [ ] E2E full model inference (requires MODEL_PATH env var)

## Documentation

- [x] quickstart.md provides accurate, executable examples
- [x] docs/runtime/device-profiles.md created
- [x] docs/runtime/optimization-troubleshooting.md created
- [x] .github/copilot-instructions.md updated with service patterns
- [x] README.md updated with optimization section

## Regression

- [x] AIRuntime.streamCompletion() public API unchanged
- [x] ChatMessage, CompletionOutput types unchanged
- [x] Premium 8 GB device inference unchanged (tier selected transparently)
