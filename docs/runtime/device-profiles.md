# Device Profile Reference

**Feature**: Runtime Optimization (001-optimize-runtime-planning)  
**Source**: `shared/ai/device-profiles.ts`

## Three-Tier Device Classification

Devices are automatically classified based on available RAM (total RAM minus used and OS overhead). Classification happens at model load time via `DeviceDetector.detect()`.

| Tier | Available RAM | Target Devices | Use Case |
|------|--------------|----------------|----------|
| **Budget** | < 5 GB | 4 GB Android phones | Constrained inference, max reliability |
| **Mid-Range** | 5–7 GB | 6 GB Android phones | Balanced performance |
| **Premium** | ≥ 7 GB | 8+ GB flagship iOS/Android | Maximum quality |

---

## Budget Profile (3–5 GB RAM)

**Target**: 4 GB Android devices with ~3.2 GB available RAM

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `n_ctx` | 1024 | Minimum viable context window; avoids KV cache OOM |
| `n_batch` | 64 | Small prefill batch for stable throughput under memory pressure |
| `n_threads` | 4 | Capped at physical core count |
| `n_gpu_layers` | 0 | CPU-only; avoids VRAM pressure on entry-level GPUs |
| `use_mmap` | `true` | **Critical** — reduces cold-start RAM by 40–60% |
| `use_mlock` | `false` | Must not lock on mobile — causes OOM termination |
| `cache_type_k` | `q8_0` | 50% KV cache memory reduction vs f16 |
| `cache_type_v` | `q8_0` | 50% KV cache memory reduction vs f16 |

**Performance Expectations:**

| Metric | Min | Max |
|--------|-----|-----|
| Time to First Token (TTFT) | 3 s | 5 s |
| Sustained Throughput | 6 tok/s | 8 tok/s |
| Peak Memory | — | 3500 MB |
| Crash Risk (pre-optimization) | — | 35% |

**Compatible Models:**
- Max model size: 3.5 GB
- Recommended quantization: Q4_K_M
- ⚠️ Warning: Limited to 1K context. 7B models may require batch reduction.

---

## Mid-Range Profile (5–7 GB RAM)

**Target**: 6 GB Android devices with ~5.2 GB available RAM

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `n_ctx` | 2048 | Comfortable for most conversations |
| `n_batch` | 128 | Balanced prefill performance |
| `n_threads` | 6 | Uses majority of available cores |
| `n_gpu_layers` | 50 | Partial GPU offload for accelerated decode |
| `use_mmap` | `true` | Still beneficial for cold-start |
| `use_mlock` | `false` | Not needed at this tier |
| `cache_type_k` | `q8_0` | Memory-efficient by default |
| `cache_type_v` | `q8_0` | Memory-efficient by default |

**Performance Expectations:**

| Metric | Min | Max |
|--------|-----|-----|
| TTFT | 1.5 s | 2.5 s |
| Sustained Throughput | 8 tok/s | 10 tok/s |
| Peak Memory | — | 5200 MB |
| Crash Risk | — | 12% |

**Compatible Models:**
- Max model size: 5 GB
- Recommended quantization: Q5_K_M
- ⚠️ 2K context recommended. Larger models may throttle.

---

## Premium Profile (7+ GB RAM)

**Target**: 8+ GB iOS/Android flagship devices with ~7.2 GB available RAM

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `n_ctx` | 4096 | Full extended context |
| `n_batch` | 512 | Maximum throughput prefill |
| `n_threads` | 8 | Full thread utilization |
| `n_gpu_layers` | 99 | Full GPU offload (all layers) |
| `use_mmap` | `false` | Enough RAM for direct load |
| `use_mlock` | `false` | Not required |
| `cache_type_k` | `f16` | Full precision KV cache |
| `cache_type_v` | `f16` | Full precision KV cache |

**Performance Expectations:**

| Metric | Min | Max |
|--------|-----|-----|
| TTFT | 0.7 s | 1.2 s |
| Sustained Throughput | 12 tok/s | 15 tok/s |
| Peak Memory | — | 7500 MB |
| Crash Risk | — | 3% |

**Compatible Models:**
- Max model size: 13 GB
- Recommended quantization: Q6_K_M

---

## Common Issues and Workarounds

### "Model loads but inference is very slow on budget device"
- **Cause**: n_gpu_layers > 0 on a device without adequate GPU VRAM
- **Fix**: Override to CPU-only: `loadModel(id, path, { n_gpu_layers: 0 })`

### "OOM crash during inference on 4 GB device"
- **Cause**: Context window too large for available RAM
- **Fix**: The AIRuntime OOM fallback automatically halves `n_ctx` and retries.
  To prevent: use budget profile which constrains to 1024 tokens.

### "Inference works but outputs repeat or truncate at token 1024"
- **Cause**: Budget context window (1024) reached
- **Expected**: Normal behavior on budget devices. Clear chat history to reset.

### "Device is classified as 'budget' but has 6 GB RAM"
- **Cause**: Classification uses *available* RAM (total − used − OS overhead of 0.8 GB).
  Heavy background apps reduce available RAM below the 5 GB midRange threshold.
- **Workaround**: Kill background apps or override: `loadModel(id, path, { n_ctx: 2048 })`

### "GPU layers appear to be ignored on Android"
- **Cause**: GPU VRAM was detected as < 1000 MB (heuristic = 30% of total RAM on budget device)
- **Fix**: The RuntimeConfigGenerator automatically caps `n_gpu_layers` to 20 when VRAM < 1 GB.
