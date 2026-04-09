# Implementation Plan: Private Shadow Reflection Journal

**Branch**: `001-private-shadow-journal` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-private-shadow-journal/spec.md`

## Summary

Aplicativo Android de reflexão pessoal com IA local (ExecuTorch + Qwen 2.5) e RAG sobre conteúdo filosófico junguiano pré-embeddado. O app já possui infraestrutura significativa: feature reflection com CRUD, geração de perguntas, fallback e retry; feature review com serviço de síntese; feature export com pipeline markdown. O trabalho restante foca em: (1) fluxo obrigatório de 3 telas de onboarding (segurança → modelo → loading), (2) persistência real do review repository (atualmente in-memory), (3) wire-up das rotas placeholder review/export, (4) empacotamento do rag-content.db bundled, e (5) montagem do ThemeProvider faltante no layout raiz.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, React Native 0.81.5
**Primary Dependencies**: Expo SDK 54, Expo Router 6, react-native-executorch 0.8, react-native-rag 0.8, react-native-mmkv 4.3, Legend State 3.0-beta, NativeWind 4.2, @rn-primitives
**Storage**: MMKV (múltiplas instâncias: `reflection_encrypted`, `generation_jobs`, `app_lock`, `powerlists-storage`), OPSQLite Vector Store (`reflection-rag-v1`), Expo SecureStore (PIN hash)
**Testing**: Jest (configurado em jest.config.ts); Bun test via type alias `bun:test` → Jest; 11 spec files existentes (unit, integration, e2e)
**Target Platform**: Android only v1 (iOS deferred to v2)
**Project Type**: Mobile app (Expo + Expo Router, desenvolvimento local com dev client)
**Performance Goals**:

- Guided question generation (≤500 words): ≤8s p95
- Final review generation (≤30 entries): ≤20s p95
- Markdown export (≤365 entries): ≤10s p95
  **Constraints**:
- 100% offline — sem transmissão externa de reflexões ou conteúdo gerado
- RAM usage capped at 60% do total do dispositivo
- rag-content.db: usar expo-sqlite para criar schema vazio e popular via seed no primeiro launch (NÃO bundlar .db completo como asset)
- Modelos Qwen 2.5: 0.5B, 1.5B, 3B (com variantes quantizadas); default: `qwen2.5-0.5b-quantized`, context 4096
- NativeWind className-only — zero inline style com @rn-primitives
  **Scale/Scope**: Single-user, personal journal; v1 Android only

## Constitution Check (Post-Design Re-evaluation)

_RE-evaluated after Phase 1 design completion._

- **Code Quality Gate**: ✅ PASS — Architecture defined. New `features/onboarding/` module follows established MVVM + Repository + Service pattern. Three new repositories (CredentialRepository, ModelRepository, migrated ReviewRepository) use existing MMKV patterns. Device detection service is a pure utility with no new abstractions. Complexity is justified by mandatory onboarding gate (US-0, P0).
- **Testing Gate**: ✅ PASS — Test plan defined for all user stories. US-0: unit (device detector, model filtering, security gate state), integration (credential persistence, model config persistence), e2e (full onboarding flow first-time + returning). US-1: existing tests cover guided questions; new tests needed for RAG with rag-content.db instead of past reflections. US-2: integration test for review persistence (critical — fixes in-memory bug). US-3: existing export pipeline tests sufficient.
- **UX Consistency Gate**: ✅ PASS — All three onboarding screens will use existing `Button`, `Text`, and `StateView` primitives with NativeWind className. Each screen defines loading, empty, success, error states per contract. ThemeProvider mounting fix added to plan (one-line change in `_layout.tsx`).
- **Performance Gate**: ✅ PASS — Measurable budgets defined: model loading ≤10s (0.5B quantized), device detection ≤200ms, 60% RAM cap enforced at model selection time. Performance validation approach: manual timing on target device class + automated unit tests for filtering logic.

**Gate outcome**: ✅ ALL PASS — No violations. Implementation can proceed to task decomposition.

## Project Structure

### Documentation (this feature)

```text
specs/001-private-shadow-journal/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
app/
├── _layout.tsx                          # FIX: mount ThemeProvider
├── index.tsx                            # OK: delegates to reflection feature
├── review.tsx                           # FIX: wire to review feature screen
└── export.tsx                           # FIX: wire to export feature screen

features/
├── onboarding/                          # NEW feature module
│   ├── model/
│   │   ├── user-credential.ts           # UserCredential entity
│   │   └── model-configuration.ts       # ModelConfiguration entity
│   ├── repository/
│   │   ├── credential-repository.ts     # MMKV persistence for auth state
│   │   └── model-repository.ts          # MMKV persistence for model config
│   ├── service/
│   │   ├── device-detector.ts           # Detect RAM, storage, filter models
│   │   └── model-manager.ts             # Download, load, verify model
│   ├── view/
│   │   ├── security-gate-screen.tsx     # Screen 1: password + biometric
│   │   ├── model-selection-screen.tsx   # Screen 2: browse/download models
│   │   └── model-loading-screen.tsx     # Screen 3: load model, block access
│   ├── view-model/
│   │   ├── use-security-gate-vm.ts
│   │   ├── use-model-selection-vm.ts
│   │   └── use-model-loading-vm.ts
│   └── index.ts                         # Barrel exports
├── reflection/                          # EXISTING — no changes needed
├── review/
│   ├── repository/
│   │   └── review-repository.ts         # FIX: replace Map with MMKV
│   └── ...                              # rest unchanged
└── export/                              # EXISTING — no changes needed

shared/
├── ai/
│   └── local-ai-runtime.ts              # EXISTING — may need RAM cap integration
├── storage/
│   ├── encrypted-reflection-store.ts    # EXISTING
│   └── generation-job-store.ts          # EXISTING
├── security/
│   ├── app-lock.ts                      # EXISTING — may extend for password creation
│   └── use-app-lock.ts                  # EXISTING
└── components/
    └── state-view.tsx                   # EXISTING — reuse for loading/error states

assets/
└── models/
    └── rag-content.db                   # NEW: bundled RAG database
    └── qwen2.5-0.5b-quantized.bin       # (optional) bundled default model

tests/
├── unit/
│   ├── onboarding/
│   │   ├── device-detector.spec.ts
│   │   ├── model-filtering.spec.ts
│   │   └── security-gate-state.spec.ts
│   └── ...                              # existing tests
├── integration/
│   ├── onboarding/
│   │   ├── credential-persistence.spec.ts
│   │   ├── model-config-persistence.spec.ts
│   │   └── review-persistence.spec.ts   # NEW: fix in-memory issue
│   └── ...
└── e2e/
    ├── onboarding-flow.spec.ts          # NEW: first-time + returning user
    └── ...
```

**Structure Decision**: Single project with feature-based modular architecture (existing pattern). New `features/onboarding/` module follows the same MVVM + Repository + Service pattern as `features/reflection/`, `features/review/`, and `features/export/`. Three app routes (`review.tsx`, `export.tsx`) are wired to existing feature screens. `_layout.tsx` gets ThemeProvider mounted.

## Complexity Tracking

> **Filled because Constitution Check identified one violation requiring justification**

| Violation                                                | Why Needed                                                         | Simpler Alternative Rejected Because                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| ReviewRepository migration from Map to MMKV              | Reviews must persist across app restarts (FR-006, SC-003)          | In-memory Map loses all reviews on restart, making period review unusable and violating offline acceptance criteria |
| New `features/onboarding/` module (3 screens + services) | Mandatory gate through which every user passes (US-0, P0 priority) | Embedding onboarding logic in existing features would violate separation of concerns and make testing impossible    |
