# Implementation Plan: AI Chat App Restructure

**Branch**: `002-ai-chat-app` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-ai-chat-app/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the current app structure (reflection, review, onboarding screens) with a two-screen AI chat application: Chat (root) and Chat History (stack-pushed from Chat header). Model selection, download, and loading occur inline within the Chat screen using llama.rn for local GGUF inference. All data persists locally with zero external network calls for generation.

## Technical Context

**Language/Version**: TypeScript 5.9
**Primary Dependencies**: React 19.1, React Native 0.81.5, Expo SDK 54, Expo Router 6, llama.rn (native inference), Legend State 3.0-beta (reactivity), NativeWind 4.2 (styling), @rn-primitives (UI components), react-native-mmkv 4.3 (local persistence)
**Storage**: react-native-mmkv for chat conversations/messages; expo-file-system for GGUF model downloads
**Testing**: Jest (unit/integration), with mocked llama.rn native module
**Target Platform**: Android + iOS via Expo (React Native New Architecture enabled)
**Project Type**: Mobile app (React Native + Expo Router)
**Performance Goals**: First token <5s, streaming token display <200ms latency, history list 100 items <500ms render
**Constraints**: Offline-capable after model download; model loading memory-bound (~600MB RAM for 0.5B model); no external API calls for generation
**Scale/Scope**: 2 screens, 3 entities (ChatConversation, ChatMessage, ModelConfiguration), local-only data

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Code Quality Gate**: All changes MUST pass `npm test && npx tsc --noEmit`. New chat screens, view-models, and repositories will be small composable units (service → repository → view-model → screen). No new abstractions beyond existing patterns (local-ai-runtime service already exists). Removal of reflection/review/onboarding will delete ~15+ files — cleanup must leave zero dangling imports.
- **Testing Gate**: Each user story requires: (1) unit tests for view-models and services with mocked llama.rn, (2) integration tests for full load-model → generate → save flow, (3) end-to-end tests for user journey (open app → download model → chat → verify history). Regression tests: verify no import of removed reflection/review/onboarding modules remains in bundle.
- **UX Consistency Gate**: Two new screens (Chat, History) MUST use NativeWind design tokens + @rn-primitives. Required states: Chat (no model loaded, downloading, model loading, generating response, error, empty conversation), History (no conversations, loading list, empty state). Accessibility: labels for chat input, message bubbles, model selector, download progress, history nav button.
- **Performance Gate**: First token <5s with 0.5B model (validated via profiling). Streaming token display <200ms (measured by onToken callback timing). History list 100 items <500ms render. If performance misses budget, mitigation: recommend smaller quantization (Q2_K vs Q4_K_M) or prompt user.

**Gate Outcome**: ✅ All four gates PASS — requirements are clear, achievable, and aligned with existing architecture.

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-chat-app/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── _layout.tsx                  # Root layout (updated routes)
│   ├── (chat)/
│   │   ├── _layout.tsx              # Chat stack navigator
│   │   ├── index.tsx                # Chat screen (root)
│   │   └── history.tsx              # Chat history screen (stack-pushed)
│   └── +not-found.tsx
├── features/
│   ├── chat/
│   │   ├── view/
│   │   │   ├── chat-screen.tsx
│   │   │   └── history-screen.tsx
│   │   ├── view-model/
│   │   │   ├── use-chat-vm.ts
│   │   │   └── use-history-vm.ts
│   │   ├── service/
│   │   │   └── chat-service.ts      # Save/load/delete conversations
│   │   └── model/
│   │       ├── chat-conversation.ts
│   │       └── chat-message.ts
│   └── onboarding/
│       ├── view/                    # Model selection/download widgets (reused in-chat)
│       │   └── model-picker.tsx
│       ├── view-model/
│       │   └── use-model-loading-vm.ts (updated for in-chat loading)
│       └── service/
│           └── model-manager.ts     # Download, verify, load models
├── shared/
│   └── ai/
│       └── local-ai-runtime.ts      # Already exists — llama.rn wrapper
└── components/                      # Shared UI primitives (message bubbles, input, etc.)
    ├── chat/
    │   ├── message-bubble.tsx
    │   ├── chat-input.tsx
    │   └── model-selector.tsx
    └── history/
        └── conversation-item.tsx

tests/
├── unit/
│   ├── chat/
│   │   ├── chat-service.spec.ts
│   │   ├── use-chat-vm.spec.ts
│   │   └── chat-conversation.spec.ts
│   └── onboarding/
│       └── model-manager.spec.ts
├── integration/
│   └── chat/
│       └── chat-flow.spec.ts
└── e2e/
    └── chat/
        └── chat-journey.e2e.spec.ts
```

**Structure Decision**: Single project mobile app. New `features/chat/` module owns chat screens, view-models, services, and models. Existing `features/onboarding/` is partially retained (model management only — model selection/download reused inline in chat). Existing `features/reflection/` and `features/review/` are fully deleted. `shared/ai/local-ai-runtime.ts` is reused as-is. Routing uses Expo Router stack navigation within `app/(chat)/` group.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                                                                                                                                   | Why Needed | Simpler Alternative Rejected Because |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------ |
| N/A — no constitution violations. Feature reuses existing patterns (local-ai-runtime, model-manager, Legend State VMs, NativeWind styling). |            |                                      |

---

## Post-Design Constitution Check

_Re-evaluated after Phase 1 design completion._

- **Code Quality Gate**: ✅ Data model is clean (4 entities with clear boundaries). Contracts document service interfaces explicitly. No circular dependencies — chat-service depends only on MMKV and local-ai-runtime. Deletion of reflection/review will be validated via import grep sweep.
- **Testing Gate**: ✅ Contracts define clear test boundaries — each ChatService method has defined inputs/outputs/errors suitable for unit mocking. Integration flow test maps to load-model → generate → save chain. E2E journey test maps to spec's User Story 1 acceptance scenarios.
- **UX Consistency Gate**: ✅ Screen state matrix documented: Chat (6 states), History (3 states). All use NativeWind + @rn-primitives. Accessibility targets specified (labels, contrast, feedback).
- **Performance Gate**: ✅ Data model supports performance targets: index key avoids full-body loads for history list (<500ms). FlatList virtualization handles 1000+ messages. In-place token append avoids re-render jank (<200ms per token).

**Post-Design Gate Outcome**: ✅ All four gates PASS. No new violations or complexity introduced.
