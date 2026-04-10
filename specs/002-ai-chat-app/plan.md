# Implementation Plan: AI Chat App Restructure

**Branch**: `002-ai-chat-app` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-ai-chat-app/spec.md` (updated with architecture clarifications)

## Summary

Replace the current app structure (reflection, review, onboarding screens) with a three-screen AI chat application: **Chat** (root), **Model Management** (stack-pushed from Chat header), and **Chat History** (stack-pushed from Chat header). All AI operations (inference, model download, model lifecycle) are owned by `shared/ai/`. Each feature module co-locates its own components. Model management is a separate feature module with its own screen, VM, and components. All data persists locally with zero external network calls for generation.

## Technical Context

**Language/Version**: TypeScript 5.9
**Primary Dependencies**: React 19.1, React Native 0.81.5, Expo SDK 54, Expo Router 6, llama.rn (native inference), Legend State 3.0-beta (reactivity), NativeWind 4.2 (styling), @rn-primitives (UI components), react-native-mmkv 4.3 (local persistence), expo-file-system (model downloads)
**Storage**: react-native-mmkv for chat conversations + model config; expo-file-system for GGUF model downloads
**Testing**: Jest (unit/integration), with mocked llama.rn native module
**Target Platform**: Android + iOS via Expo (React Native New Architecture enabled)
**Project Type**: Mobile app (React Native + Expo Router)
**Performance Goals**: First token <5s, streaming token display <200ms latency, history list 100 items <500ms render
**Constraints**: Offline-capable after model download; model loading memory-bound (~600MB RAM for 0.5B model); no external API calls for generation
**Scale/Scope**: 3 screens, 3 entities (ChatConversation, ChatMessage, ModelConfiguration), local-only data

## Architecture Decisions (from Clarifications)

### 1. shared/ai/ is the Single AI Owner

- `shared/ai/local-ai-runtime.ts` — llama.rn wrapper (initLlama, completion, tokenize)
- `shared/ai/model-manager.ts` — model lifecycle (download, verify, load, unload, persist active model)
- Features import AI ops from `@/shared/ai/` — never manage models or inference directly

### 2. Feature Modules Own Their Storage and UI

- `features/chat/service/chat-service.ts` — MMKV CRUD for conversations (create, read, list index, delete, rename)
- `features/chat/components/` — co-located UI (MessageBubble, ChatInput, etc.)
- `features/history/` — co-located screen, VM, components
- `features/model-management/` — co-located screen, VM, components

### 3. Co-Located Components Pattern

Each feature module contains: `view/` (screen), `view-model/` (Legend State VM), `service/` (feature storage ops), `components/` (feature-specific UI). Root `components/` is removed for feature-specific UI.

### 4. Model Management as Separate Feature

Separate `features/model-management/` with its own screen, view-model, and components. Accessed via stack navigation from Chat header. Handles model catalog browsing, download with progress, load/unload, RAM warnings, disk space validation.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Code Quality Gate** (Constitution Principle I): All changes MUST pass `npm test && npx tsc --noEmit`. New screens, VMs, and services follow small composable units. `shared/ai/` is the single abstraction for AI — no new abstractions needed. Model manager moves from onboarding to shared/ai (reuse, not new complexity). Onboarding/feature removal deletes ~15+ files — cleanup verified via grep sweep.
- **Testing Gate** (Constitution Principle II): Each user story requires: (1) unit tests for VMs and services with mocked llama.rn, (2) integration tests for download-model → load-model → generate → save flow, (3) E2E for full user journey. Regression: zero imports of removed modules in bundle. Test files co-located with features.
- **UX Consistency Gate** (Constitution Principle III): Three screens (Chat, Model Management, History) MUST use NativeWind tokens + @rn-primitives. All states defined: Chat (no model, generating, error, empty), Model Mgmt (no models, downloading, loading, failed, RAM warning), History (no conversations, loading, empty). Accessibility on all interactive elements.
- **Performance Gate** (Constitution Principle IV): First token <5s with 0.5B model. Streaming <200ms/token. History 100 items <500ms. Validated via profiling on 4GB RAM device. Mitigation: recommend smaller quantization if budget missed.

**Gate Outcome**: ✅ All four gates PASS — architecture aligns with constitution. shared/ai/ provides clear ownership, co-located components keep features independent, model management feature has clean boundaries.

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-chat-app/
├── plan.md              # This file
├── spec.md              # Updated with architecture clarifications
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (regenerated after plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── _layout.tsx                  # Root layout → (chat) route group
│   ├── (chat)/
│   │   ├── _layout.tsx              # Chat stack navigator
│   │   ├── index.tsx                # Chat screen (root)
│   │   ├── models.tsx               # Model Management screen (stack-pushed)
│   │   └── history.tsx              # Chat History screen (stack-pushed)
│   └── +not-found.tsx
├── features/
│   ├── chat/
│   │   ├── view/
│   │   │   └── chat-screen.tsx      # Screen delegates to components/
│   │   ├── view-model/
│   │   │   └── use-chat-vm.ts       # Legend State: messages, send, cancel
│   │   ├── service/
│   │   │   └── chat-service.ts      # MMKV CRUD for conversations
│   │   └── components/
│   │       ├── message-bubble.tsx
│   │       ├── chat-input.tsx
│   │       ├── model-badge.tsx
│   │       └── empty-chat.tsx
│   ├── history/
│   │   ├── view/
│   │   │   └── history-screen.tsx
│   │   ├── view-model/
│   │   │   └── use-history-vm.ts
│   │   └── components/
│   │       ├── conversation-list.tsx
│   │       ├── conversation-item.tsx
│   │       └── empty-history.tsx
│   └── model-management/
│       ├── view/
│       │   └── models-screen.tsx
│       ├── view-model/
│       │   └── use-models-vm.ts
│       └── components/
│           ├── model-catalog.tsx
│           ├── model-item.tsx
│           ├── download-progress.tsx
│           └── ram-warning.tsx
├── shared/
│   └── ai/
│       ├── local-ai-runtime.ts      # llama.rn wrapper (inference only)
│       ├── model-manager.ts         # Model lifecycle (download → verify → load)
│       └── model-catalog.ts         # Available models metadata
└── components/
    └── ui/                          # Cross-cutting primitives only
        └── icon.tsx

tests/
├── unit/
│   ├── chat/
│   ├── history/
│   └── model-management/
├── integration/
│   └── chat/
└── e2e/
    └── chat/
```

**Structure Decision**: Single project mobile app with strict feature boundaries. `shared/ai/` owns all AI operations (inference + model lifecycle). Each feature (`chat`, `history`, `model-management`) is self-contained with co-located components, view-model, and services. No cross-feature imports of components. Root `components/ui/` has only cross-cutting primitives. `features/onboarding/` fully removed.

## Complexity Tracking

| Violation                         | Why Needed                                                                                            | Simpler Alternative Rejected Because                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Separate model-management feature | Model lifecycle has 8+ UX states, download progress, RAM checks — too complex to embed in Chat screen | Embedding in Chat would bloat screen, mix concerns, violate SRP |
| shared/ai/ as single owner        | Model lifecycle (download → verify → load) is cross-cutting — any AI feature would need it            | Duplicating model ops per feature would diverge behavior        |
| Co-located components per feature | Feature boundaries prevent accidental cross-feature coupling                                          | Central components/ becomes dumping ground with implicit deps   |

## Post-Design Constitution Check

_Re-evaluated after architecture clarifications._

- **Code Quality Gate**: ✅ shared/ai/ eliminates duplication. Co-located components keep features independent. No circular deps.
- **Testing Gate**: ✅ Each feature has clear test boundary. shared/ai/ mocked at runtime level. Feature tests don't leak across boundaries.
- **UX Consistency Gate**: ✅ 3 screens × defined state matrices. All NativeWind + @rn-primitives. Accessibility on all interactive elements.
- **Performance Gate**: ✅ Architecture supports budgets: shared/ai/ avoids double-init, co-located components reduce import overhead, MMKV index avoids full-body loads.

**Post-Design Gate Outcome**: ✅ All four gates PASS. Architecture decisions reduce complexity vs. original plan.
