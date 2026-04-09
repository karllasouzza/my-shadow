# ADR-0002: Migrate AI Runtime from ExecuTorch to llama.rn

**Status**: Adopted
**Date**: 2026-04-09
**Decision Makers**: Private Shadow Journal Team
**Supersedes**: Portions of ADR-0001 (Local-Only AI Inference section)

## Context

The initial architecture (ADR-0001) specified `react-native-executorch` with `@react-native-rag/executorch` for local AI inference. During Phase 1 implementation, we encountered a critical blocker:

### Problem: ExecuTorch Error Code 35

When attempting to load GGUF models on Android via ExecuTorch, the runtime consistently returned **error code 35** (model load failure). Investigation revealed:

1. ExecuTorch's GGUF support is experimental and incomplete
2. Model format compatibility is limited to ExecuTorch-specific `.pte` files, not standard GGUF
3. The `@react-native-rag/executorch` package is designed for `.pte` model loading, not GGUF
4. No stable path exists for loading open GGUF models (Qwen 2.5, Llama 3, etc.) on ExecuTorch React Native bindings

This blocked the core feature: local GGUF model inference on Android.

### Requirements

We need a runtime that:

- Loads standard GGUF model files directly
- Works on Android with React Native 0.81+ and New Architecture
- Supports streaming token generation with callbacks
- Provides GPU acceleration (OpenCL/Vulkan)
- Maintains the privacy guarantee of zero external API calls

## Decision

**Migrate from ExecuTorch to llama.rn for text generation.**

Replace:

```json
{
  "react-native-executorch": "^0.8.1",
  "react-native-executorch-expo-resource-fetcher": "^0.8.0"
}
```

With:

```json
{
  "llama.rn": "^0.10.0"
}
```

Keep (temporary):

```json
{
  "@react-native-rag/executorch": "^0.8.0"
}
```

For RAG vector embeddings only, until llama.rn provides a stable embedding API.

### llama.rn Integration

- **Plugin**: `llama.rn` Expo plugin with `enableEntitlements`, `forceCxx20`, `enableOpenCLAndHexagon`
- **ProGuard**: `-keep class com.rnllama.** { *; }` via `expo-build-properties`
- **API**: `initLlama()` for model loading, `context.completion()` for generation, `context.tokenize()` for tokenization
- **Model loading**: Direct file paths (`file:///path/to/model.gguf`) instead of resource bundles

### Migration Changes

| Area             | ExecuTorch                                   | llama.rn                                                      |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Initialization   | `initExecutorch()` + `ExpoResourceFetcher`   | No init needed (native module auto-loads)                     |
| Model loading    | `ExecuTorchLLM` with model/tokenizer sources | `initLlama({ model: "file://...", n_ctx, n_gpu_layers })`     |
| Generation       | `llm.generate(messages, callback)`           | `context.completion({ messages, n_predict, stop }, callback)` |
| Tokenization     | `TokenizerModule.encode()`                   | `context.tokenize()` (built-in)                               |
| Model unload     | `llm.unload()`                               | `context.release()`                                           |
| GPU acceleration | Not available                                | `n_gpu_layers: 99` (OpenCL on Android)                        |

## Alternatives Considered

### 1. Fix ExecuTorch GGUF Support

**Rejected because:**

- ExecuTorch GGUF support is not stable on React Native
- Error code 35 has no documented resolution path
- Would require forking and maintaining ExecuTorch RN bindings
- Model format incompatibility is fundamental (`.pte` vs GGUF)

### 2. Use MLX (Apple Silicon only)

**Rejected because:**

- iOS/macOS only — v1 targets Android
- Would require separate Android backend anyway
- Adds complexity of dual-runtime maintenance

### 3. Use WebLLM (WASM in WebView)

**Rejected because:**

- Performance penalty of WASM in WebView (~3-5x slower)
- No GPU acceleration in WebView context
- Memory limits in WebView environment
- Breaks the "native module" pattern established in architecture

### 4. Use MLC LLM

**Rejected because:**

- More complex build pipeline (requires TVM compilation)
- Larger binary size (+100MB vs llama.rn's ~30MB)
- Less active community support for React Native
- llama.rn has simpler Expo plugin integration

## Consequences

### Positive

- GGUF model files load directly without conversion
- Error code 35 eliminated (native GGUF support)
- GPU acceleration via OpenCL on Android (~2x faster generation)
- Simpler API surface (no separate tokenizer module)
- Active community and regular releases
- Standard GGUF format enables any compatible model (Qwen, Llama, Mistral, etc.)

### Negative

- Requires native compilation (longer `npx expo run:android` builds)
- `@react-native-rag/executorch` dependency retained temporarily for embeddings
- Native module requires development build (cannot use Expo Go)
- Slightly larger native binary (+30MB for llama.rn native libs)

### Mitigation

- ProGuard rules configured via `expo-build-properties` plugin
- Embedding migration planned for Phase 2-3
- Development builds distributed via EAS Build
- Native artifacts downloaded automatically via `download-native-artifacts.js`

## Implementation Status

- [x] T008-T022: Runtime migration (local-ai-runtime.ts rewritten for llama.rn)
- [x] T023-T027: llama.rn mock for testing
- [x] T028-T030: Model loading and download flow
- [x] T031-T035: Generation pipeline update
- [x] T066: README updated with llama.rn setup
- [x] T067: Architecture doc updated
- [x] T068: This ADR
- [ ] Phase 2: Migrate embeddings from executorch to llama.rn
- [ ] Phase 3: Remove `@react-native-rag/executorch` entirely

## References

- Quickstart guide: [quickstart.md](../../specs/001-private-shadow-journal/quickstart.md)
- Runtime code: [local-ai-runtime.ts](../../shared/ai/local-ai-runtime.ts)
- llama.rn: https://github.com/mybigday/llama.rn
