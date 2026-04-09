# Implementation Plan: Migrate AI Runtime from ExecuTorch to llama.rn

**Branch**: `001-private-shadow-journal` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: User request to migrate from `react-native-executorch` to `llama.rn` for native GGUF model support
**Context**: Download system works (downloads .gguf files), but ExecuTorch expects .pte format. llama.rn natively supports GGUF.

## Summary

Migrate the local AI runtime stack from `react-native-executorch` (which requires `.pte` format) to `llama.rn` (which natively supports `.gguf` files). This change enables the existing model download flow (which downloads GGUF files from HuggingFace) to work correctly with the runtime, resolving the "Failed to load model" error (code 35). The migration involves replacing native module initialization, model loading, completion generation, and tokenizer handling while preserving the RAG/embeddings system and all higher-level application logic.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81.5
**Primary Dependencies**:

- **Current**: `react-native-executorch` ^0.8.1, `@react-native-rag/executorch` ^0.8.0, `react-native-executorch-expo-resource-fetcher` ^0.8.0
- **Target**: `llama.rn` ^0.10+ (requires React Native New Architecture)
  **Storage**: expo-file-system (model downloads), MMKV (configuration), OPSQLite (RAG vector store)
  **Testing**: Bun test runner (native TypeScript support)
  **Target Platform**: Android only (v1), iOS deferred to v2
  **Project Type**: Mobile app (Expo SDK 54, Expo Router 6)
  **Performance Goals**:
- Guided question generation: <8s p95 for 500-word reflection
- Final review generation: <20s p95 for 30 entries
- Model loading: <30s for 0.5B Q4 model on mid-tier Android
  **Constraints**:
- Maximum 60% of total device RAM for LLM runtime
- Must remain fully offline-capable (no cloud dependencies)
- Must support streaming completions with progress callbacks
- Must maintain Brazilian Portuguese + Jungian tone constraints
  **Scale/Scope**: Single-user, local-first, 1-3 model variants (0.5B, 1.5B, 3B Qwen 2.5/3)

### Key Architecture Changes

1. **Native Module Initialization**:
   - **Current**: `initExecutorch({ resourceFetcher: ExpoResourceFetcher })`
   - **Target**: `import { initLlama } from 'llama.rn'` → `initLlama({ model, use_mlock, n_ctx, n_gpu_layers })`

2. **Model Loading**:
   - **Current**: `new ExecuTorchLLM({ modelSource, tokenizerSource, chatConfig }).load()`
   - **Target**: `initLlama({ model: 'file://<path>.gguf', n_ctx: 4096, n_gpu_layers: 99, use_mlock: true })`

3. **Completion Generation**:
   - **Current**: `llm.generate(messages, streamCallback)`
   - **Target**: `context.completion({ messages, n_predict, stop }, streamCallback)`

4. **Tokenizer**:
   - **Current**: Separate `TokenizerModule.load()` + `encode()/decode()`
   - **Target**: Built-in `context.tokenize()` / `context.detokenize()` (part of llama.rn context)

5. **RAG/Embeddings**:
   - **Current**: `ExecuTorchEmbeddings` with `MULTI_QA_MINILM_L6_COS_V1`
   - **Target**: Keep `@react-native-rag/executorch` for embeddings OR migrate to llama.rn's `context.embedding()` / `context.rerank()` (requires research)

### NEEDS CLARIFICATION (Research Required)

1. **RAG Embeddings Strategy**: Does llama.rn provide embedding models compatible with the existing rag-content.db vector store? Or must we keep `@react-native-rag/executorch` for embeddings?
2. **ExpoResourceFetcher Replacement**: llama.rn uses direct file paths. Do we still need ExpoResourceFetcher for bundled models, or can we ship GGUF files as assets and copy to documentDirectory?
3. **Model Preset Migration**: Current code has presets for QWEN2_5_0_5B, QWEN2_5_1_5B, etc. These are specific to react-native-executorch. Need to create new presets for llama.rn with GGUF paths.
4. **Android ProGuard Configuration**: llama.rn requires ProGuard rules. Need to verify if Expo/Expo Router build process applies ProGuard and how to inject rules.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Code Quality Gate ✅

- **Lint/Type Compliance**: All changes must pass `tsc --noEmit` and `expo lint`
- **Abstraction Strategy**: Replace runtime internals while preserving `LocalAIRuntimeService` public interface. No new abstractions without justification.
- **Expected Complexity**: Medium — replacing core runtime but keeping public API stable. Complexity justified by GGUF format compatibility requirement.

### Testing Gate ✅

- **Unit Tests**: Model loading, tokenization, completion generation with mocked llama.rn context
- **Integration Tests**: End-to-end model download → load → generate flow
- **Regression Tests**: Language leakage (pt-BR only), tone constraints, RAM budget enforcement
- **E2E Tests**: Full onboarding journey: security → download → load → generate questions

### UX Consistency Gate ✅

- **Affected Journeys**: Model loading screen (US0), reflection generation (US1), review generation (US2)
- **State Requirements**: All screens must maintain loading/empty/success/error states
- **Theme Alignment**: No UI changes expected — only runtime internals change
- **Generated Content**: Must maintain Brazilian Portuguese + Jungian shadow-work tone

### Performance Gate ✅

- **Memory Budget**: LLM runtime capped at 60% total device RAM (existing constraint)
- **Loading Time**: Model load <30s for 0.5B Q4 model
- **Generation Time**: Question generation <8s p95, review generation <20s p95
- **Validation Method**: Manual testing on target device class + performance monitoring in development builds

## Project Structure

### Documentation (this feature)

```text
specs/001-private-shadow-journal/
├── plan.md              # This file (being generated)
├── research.md          # Phase 0 output (llama.rn migration details)
├── data-model.md        # Phase 1 output (updated if model config changes)
├── quickstart.md        # Phase 1 output (updated setup instructions)
├── contracts/           # Phase 1 output (runtime interface contract)
└── tasks.md             # Phase 2 output (generated by /speckit.tasks)
```

### Source Code (repository root)

```text
shared/ai/
├── local-ai-runtime.ts          # [MODIFY] Replace ExecuTorch with llama.rn
├── reflection-rag-repository.ts # [MODIFY] Update embeddings strategy if needed
└── retry-queue-worker.ts        # [MODIFY] Update modelVersion string

features/onboarding/
├── service/
│   ├── model-manager.ts         # [KEEP] Already downloads GGUF files (correct format)
│   ├── ram-cap-integration.ts   # [MODIFY] Update model validation for llama.rn
│   └── ram-cap-validator.ts     # [MODIFY] Update model validation
└── model/
    └── model-configuration.ts   # [MODIFY] Update catalog if needed (GGUF URLs already correct)

features/reflection/service/
└── reflection-service.ts        # [MODIFY] Update modelVersion string

features/review/service/
└── review-service.ts            # [MODIFY] Update modelVersion string

package.json                     # [MODIFY] Add llama.rn, remove executorch deps
app.json                         # [MODIFY] Add llama.rn Expo plugin config
android/app/proguard-rules.pro   # [CREATE] Add llama.rn ProGuard rules (if needed)
```

**Structure Decision**: Single project (Expo app). Migration is primarily in `shared/ai/local-ai-runtime.ts` with ripple effects to configuration and dependency files. No new directories needed — existing structure supports llama.rn integration.

## Complexity Tracking

| Violation                           | Why Needed                                                      | Simpler Alternative Rejected Because                                                      |
| ----------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Runtime stack replacement           | ExecuTorch requires .pte format; downloads provide .gguf        | Converting GGUF→PTE at runtime is complex and slow; llama.rn is purpose-built for GGUF    |
| Dual embedding strategy (if needed) | llama.rn may not support same embedding model as rag-content.db | Keeping executorch for embeddings only adds dependency weight but avoids database rebuild |
