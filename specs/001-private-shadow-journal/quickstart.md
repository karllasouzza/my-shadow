# Quickstart: llama.rn Migration

## Overview

This guide covers migrating the AI runtime from ExecuTorch to llama.rn for native GGUF model support.

## Prerequisites

- React Native 0.81.5+ (with New Architecture enabled)
- Expo SDK 54+
- Bun package manager
- Android development environment (v1 target)

## Installation

```bash
# Add llama.rn
bun add llama.rn

# Download native artifacts
node ./node_modules/llama.rn/install/download-native-artifacts.js

# Install dependencies
bun install

# iOS only (deferred for v1):
# npx pod-install
```

## Configuration

### app.json

Add the llama.rn plugin to your Expo config:

```json
{
  "expo": {
    "plugins": [
      [
        "llama.rn",
        {
          "enableEntitlements": true,
          "forceCxx20": true,
          "enableOpenCLAndHexagon": true
        }
      ]
    ]
  }
}
```

### Android ProGuard (if enabled)

If using ProGuard/R8 minification, add rules via `expo-build-properties`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "android": {
            "proguardRules": "-keep class com.rnllama.** { *; }\n-keep class org.apache.commons.** { *; }"
          }
        }
      ]
    ]
  }
}
```

## Migration Steps

### 1. Update Dependencies

**Remove** (from package.json):

```json
{
  "react-native-executorch": "^0.8.1",
  "@react-native-rag/executorch": "^0.8.0",
  "react-native-executorch-expo-resource-fetcher": "^0.8.0"
}
```

**Add**:

```json
{
  "llama.rn": "^0.10.0"
}
```

**Keep** (for embeddings, temporary):

```json
{
  "@react-native-rag/executorch": "^0.8.0" // For RAG embeddings only
}
```

### 2. Update Runtime Initialization

**Before** (ExecuTorch):

```typescript
import { initExecutorch, TokenizerModule } from "react-native-executorch";
import { ExecuTorchLLM } from "@react-native-rag/executorch";

initExecutorch({ resourceFetcher: ExpoResourceFetcher });
const llm = new ExecuTorchLLM({ modelSource, tokenizerSource, chatConfig });
await llm.load();
```

**After** (llama.rn):

```typescript
import { initLlama } from "llama.rn";

const context = await initLlama({
  model: "file:///path/to/model.gguf",
  use_mlock: true,
  n_ctx: 4096,
  n_gpu_layers: 99,
  embedding: false,
});
```

### 3. Update Model Loading

Replace `resolveModelResource()` with direct file path resolution:

```typescript
// Old: Map modelId to preset (executorch-specific)
const resource = this.resolveModelResource(modelId, modelPath);

// New: Use file path directly
const modelUri = modelPath.startsWith("file://")
  ? modelPath
  : `file://${modelPath}`;
this.context = await initLlama({
  model: modelUri,
  use_mlock: true,
  n_ctx: contextLength,
  n_gpu_layers: 99,
});
```

### 4. Update Completion Generation

**Before**:

```typescript
await this.llm.generate(messages, (token) => {
  streamed += token;
});
```

**After**:

```typescript
await this.context.completion(
  {
    messages,
    n_predict: 256,
    stop: ["</s>", "<|end|>"],
  },
  ({ token }) => {
    streamed += token;
  },
);
```

### 5. Update Tokenizer

**Before**:

```typescript
const tokenizer = new TokenizerModule();
await tokenizer.load({ tokenizerSource });
const tokens = await tokenizer.encode(text);
```

**After** (built-in):

```typescript
const { tokens } = await this.context.tokenize(text);
const text = await this.context.detokenize(tokens);
```

## Testing

### Unit Tests

```bash
# Run all tests (Jest - primary runner)
npm test

# Run all tests (Bun - faster alternative)
bun test

# Run specific test
bun test tests/unit/onboarding/

# Watch mode
npm run test:watch
```

### Manual Testing

1. **Model Download**:

   ```bash
   # Start dev build
   bun run start

   # Select model in onboarding
   # Verify .gguf download completes with progress
   ```

2. **Model Loading**:

   ```
   # After download, model should load without error code 35
   # Check logs: "Model loaded successfully"
   # Note: llama.rn requires a development build (npx expo run:android)
   #       Expo Go does not support native modules
   ```

3. **Generation**:

   ```
   # Create reflection entry
   # Request guided questions
   # Verify pt-BR output with Jungian tone
   # Check response time < 8s p95
   ```

4. **RAM Budget**:
   ```
   # Test on device with known RAM (e.g., 6GB)
   # 60% budget = 3.6GB
   # Load 1.5B Q4 model (~1.8GB RAM) ✅
   # Load 3B Q4 model (~3.5GB RAM) ✅
   # Verify no OOM crashes
   ```

## Troubleshooting

### Build fails with "llama.rn native module not found"

```bash
# Reinstall and download artifacts
rm -rf node_modules
bun install
node ./node_modules/llama.rn/install/download-native-artifacts.js
```

### Model loading fails with code 35

- Verify model file exists and is valid GGUF format
- Check file path starts with `file://`
- Ensure model file is not corrupted (re-download if needed)

### Generation is slow

- Increase `n_gpu_layers` to 99 (max GPU offload)
- Reduce `n_ctx` if context window is too large
- Verify `use_mlock: true` is set (prevents swap)

### ProGuard strips llama.rn classes

Add to `android/app/proguard-rules.pro`:

```proguard
-keep class com.rnllama.** { *; }
```

## Performance Benchmarks

| Device RAM | Model        | Load Time | Generation (500 words) |
| ---------- | ------------ | --------- | ---------------------- |
| 4GB        | Qwen 0.5B Q4 | ~45s      | ~12s p95               |
| 6GB        | Qwen 1.5B Q4 | ~35s      | ~10s p95               |
| 8GB        | Qwen 3B Q4   | ~25s      | ~8s p95                |

**Target**: All within performance budgets (PF-001: <8s p95 for 500 words on 8GB)

See [docs/performance-benchmarks.md](../../docs/performance-benchmarks.md) for full benchmarks including llama.rn vs ExecuTorch comparison.

## Rollback Plan

If migration fails catastrophically:

1. Revert package.json to ExecuTorch deps
2. Restore `shared/ai/local-ai-runtime.ts` from git
3. Remove llama.rn plugin from app.json
4. Rebuild: `bun install && bun run start`

## Next Steps

After successful migration:

1. **Phase 2**: Migrate RAG embeddings from executorch to llama.rn
   - Download GGUF embedding model (`multi-qa-minilm-l6.gguf`)
   - Create separate embedding context
   - Validate rag-content.db vector compatibility

2. **Phase 3**: Remove executorch dependencies entirely
   - Drop `@react-native-rag/executorch`
   - Clean up all executorch imports
   - Reduce bundle size

3. **Phase 4**: Optimize for Android
   - Fine-tune `n_gpu_layers` per device class
   - Add OpenCL backend selection
   - Benchmark across device tiers
