---
description: "Task list for AI Chat App Restructure (feature 002)"
---

# Tasks: AI Chat App Restructure

**Input**: Design documents from `/specs/002-ai-chat-app/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are REQUIRED for each user story and for cross-cutting risk areas (model loading, privacy, cleanup of removed features).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US5)
- Include exact file paths in descriptions

## Path Conventions

- `src/` at repository root (single project mobile app)
- `tests/` at repository root
- Feature modules: `src/features/chat/`, `src/features/onboarding/`
- Routes: `src/app/(chat)/`
- Shared: `src/shared/ai/`
- Components: `src/components/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Remove legacy features, update routing, configure project for chat-only flow.

- [x] T001 Delete `src/features/reflection/` directory and all subfiles
- [x] T002 [P] Delete `src/features/review/` directory and all subfiles
- [x] T003 [P] Delete legacy onboarding routes: `src/app/onboarding/` and related screens
- [x] T004 Grep-sweep: remove all imports of reflection/review/onboarding from remaining code (verify `npm test` + `npx tsc --noEmit` passes)
- [x] T005 [P] Create route group structure: `src/app/(chat)/_layout.tsx` with stack navigator
- [x] T006 Update `src/app/_layout.tsx` to redirect root to `(chat)/` route group
- [x] T007 [P] Add jest mock config for llama.rn in `tests/__mocks__/llama.rn.ts` (verify existing mock covers completion, tokenize, embedding)

**Checkpoint**: Legacy features fully removed. Route structure ready for chat screens.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core entities, chat persistence, model picker infrastructure — MUST complete before ANY user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 [P] Define `ChatConversation` type in `src/features/chat/model/chat-conversation.ts` (fields per data-model.md)
- [x] T009 [P] Define `ChatMessage` type in `src/features/chat/model/chat-message.ts` (fields per data-model.md)
- [x] T010 Create chat repository in `src/features/chat/service/chat-service.ts` with MMKV storage (create, load, list index, delete, rename)
- [x] T011 [P] Create `model-picker.tsx` component in `src/features/onboarding/view/model-picker.tsx` (modal sheet with catalog list, download progress, RAM warning)
- [x] T012 [P] Update `use-model-loading-vm.ts` in `src/features/onboarding/view-model/` for in-chat loading flow (no navigation, callback-based)
- [x] T013 Create `message-bubble.tsx` component in `src/components/chat/message-bubble.tsx` (user/assistant/system variants, NativeWind tokens)
- [x] T014 Create `chat-input.tsx` component in `src/components/chat/chat-input.tsx` (text input, send button, disabled state, accessibility label)
- [x] T015 [P] Create `model-selector.tsx` component in `src/components/chat/model-selector.tsx` (badge showing loaded model, tap opens picker)
- [x] T016 [P] Create `conversation-item.tsx` component in `src/components/history/conversation-item.tsx` (title, updatedAt, swipe actions for rename/delete)
- [x] T017 Define Legend State observables for chat messages in `src/features/chat/view-model/` (messages list, streaming pending message, loading state)

**Checkpoint**: Foundation ready — entities, storage, UI primitives, model picker all in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Start a New Chat Conversation (Priority: P1) 🎯 MVP

**Goal**: User opens app, sees chat screen, sends a message, receives streaming AI response (model already loaded).

**Independent Test**: Open chat → type message → send → see response tokens stream progressively.

### Tests for User Story 1 (REQUIRED) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T018 [P] [US1] Unit test for `useChatVm` sendMessage flow in `tests/unit/chat/use-chat-vm.spec.ts` (mock local-ai-runtime, verify onToken callback)
- [ ] T019 [P] [US1] Integration test for load-model → generate → save flow in `tests/integration/chat/chat-flow.spec.ts`
- [ ] T020 [P] [US1] Unit test for `ChatMessage` validation (role, content length, timestamp) in `tests/unit/chat/chat-conversation.spec.ts`

### Implementation for User Story 1

- [ ] T021 [US1] Create `use-chat-vm.ts` in `src/features/chat/view-model/` with Legend State: messages observable, sendMessage(), cancelGeneration(), streaming state
- [ ] T022 [US1] Wire `sendMessage()` to `local-ai-runtime.generateCompletion()` with onToken callback for progressive rendering
- [ ] T023 [US1] Implement context window validation in `useChatVm` (tokenize, compare to n_ctx - reserved, block send if exceeded)
- [ ] T024 [US1] Create chat screen at `src/app/(chat)/index.tsx` with FlatList bound to messages observable, ChatInput, loading/empty/error states
- [ ] T025 [US1] Add cancel generation button (visible during streaming, aborts via local-ai-runtime timeout/cancel)
- [ ] T026 [US1] Persist conversation to MMKV after each user message and assistant response (call chat-service save)
- [ ] T027 [US1] Auto-generate conversation title from first user message (truncate to 50 chars) on first send
- [ ] T028 [US1] Add progress indicator during generation (spinner + "Generating..." text, PF-005: show cancel option after 30s)
- [ ] T029 [US1] Validate UX states for Chat screen: no model loaded, downloading, model loading, generating, error, empty conversation
- [ ] T030 [US1] Verify performance: first token <5s with 0.5B model (profile, record result in PR notes)

**Checkpoint**: User Story 1 is fully functional — user can chat with AI and see streaming response independently. MVP deliverable.

---

## Phase 4: User Story 2 — Download and Select AI Model In-Chat (Priority: P1)

**Goal**: User can select, download, and load a GGUF model directly from the chat screen without leaving context.

**Independent Test**: Open chat → no model loaded → model picker appears → select model → download → load → chat enabled.

### Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T031 [P] [US2] Unit test for model download flow with progress callback in `tests/unit/onboarding/model-manager.spec.ts`
- [ ] T032 [P] [US2] Unit test for RAM validation before model load in `tests/unit/onboarding/use-model-loading-vm.spec.ts`
- [ ] T033 [P] [US2] Integration test for download → verify → load chain in `tests/integration/chat/chat-flow.spec.ts`

### Implementation for User Story 2

- [ ] T034 [US2] Wire model picker modal to chat screen header (show when no model loaded or user taps model selector badge)
- [ ] T035 [US2] Integrate `model-manager.downloadModel()` with progress callback → update NativeWind progress bar in modal
- [ ] T036 [US2] Add disk space validation before download (FR-014, use expo-file-system to check available storage)
- [ ] T037 [US2] Add RAM warning before loading model (FR-015, compare estimatedRamBytes to device RAM via react-native-device-info or equivalent)
- [ ] T038 [US2] Wire `model-manager.loadModel()` after download completes → update chat screen state (enable input, show model badge)
- [ ] T039 [US2] Handle download failure state (retry button, alternate model selection, error message)
- [ ] T040 [US2] Handle model load failure (corrupt file detection, retry, fallback to model selection)
- [ ] T041 [US2] Block chat input while model is loading (FR-012, disabled state with "Loading model..." indicator)
- [ ] T042 [US2] Validate UX states for model flow: no model, browsing catalog, downloading, verifying, loading, loaded, download failed, load failed
- [ ] T043 [US2] Verify performance: download + load of 0.5B model <3 minutes on 4G (SC-002, record result)

**Checkpoint**: User Stories 1 AND 2 both work — user can download, load, and chat entirely within the chat screen.

---

## Phase 5: User Story 3 — View and Resume Chat History (Priority: P2)

**Goal**: User navigates to history screen from chat header, sees list of past conversations, taps to resume any conversation.

**Independent Test**: Create conversation → go to history → see it listed → tap → return to chat with full message history.

### Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T044 [P] [US3] Unit test for chat repository list/load in `tests/unit/chat/chat-service.spec.ts`
- [ ] T045 [P] [US3] Unit test for `useHistoryVm` in `tests/unit/chat/use-history-vm.spec.ts` (mock repository, verify list + load)
- [ ] T046 [P] [US3] Integration test for history navigation flow in `tests/integration/chat/chat-flow.spec.ts`

### Implementation for User Story 3

- [ ] T047 [US3] Create history screen at `src/app/(chat)/history.tsx` with FlatList bound to conversation index
- [ ] T048 [US3] Create `use-history-vm.ts` in `src/features/chat/view-model/` (listConversations, loadConversation, Legend State observables)
- [ ] T049 [US3] Implement `loadConversation()` in chat-service (reads full `chat:{id}` from MMKV, returns ChatConversation)
- [ ] T050 [US3] Wire history navigation button in chat header (icon button, pushes history route via Expo Router)
- [ ] T051 [US3] Wire conversation tap in history list → pop stack → load conversation into chat screen messages observable
- [ ] T052 [US3] Implement empty state for history screen (illustration/text, CTA to start new conversation)
- [ ] T053 [US3] Add loading state for history list (skeleton or spinner while index loads from MMKV)
- [ ] T054 [US3] Validate UX states for History screen: no conversations, loading list, populated list, empty state
- [ ] T055 [US3] Verify performance: history list renders 100 conversations in <500ms (SC-004, profile index read + FlatList render)

**Checkpoint**: User Stories 1, 2, AND 3 all work — user can chat, manage models, and resume past conversations.

---

## Phase 6: User Story 4 — Manage Chat Conversations (Priority: P3)

**Goal**: User can rename and delete conversations from the history screen with confirmation.

**Independent Test**: Rename conversation → see new title in list. Delete conversation → confirmation → verify removal.

### Tests for User Story 4 (REQUIRED) ⚠️

- [ ] T056 [P] [US4] Unit test for renameConversation in `tests/unit/chat/chat-service.spec.ts`
- [ ] T057 [P] [US4] Unit test for deleteConversation (with cascade) in `tests/unit/chat/chat-service.spec.ts`

### Implementation for User Story 4

- [ ] T058 [US4] Implement rename flow in history screen (long-press or swipe → text input → validate title ≤100 chars → persist)
- [ ] T059 [US4] Implement delete flow in history screen (swipe/action button → confirmation dialog → delete from MMKV + remove from index)
- [ ] T060 [US4] Update `useHistoryVm` with rename/delete actions and confirmation state
- [ ] T061 [US4] Validate delete confirmation UI (modal dialog with conversation title, "Delete" and "Cancel" buttons)
- [ ] T062 [US4] Handle edge case: delete conversation that's currently open in chat screen (navigate back to empty chat)

**Checkpoint**: All user stories are independently functional — full chat, model management, history, and conversation management.

---

## Phase 7: User Story 5 — Privacy-First Local Processing (Priority: P1)

**Goal**: Verify and document that all processing is local — no external network calls for generation, all data persists on-device only.

**Independent Test**: Monitor network traffic during chat session → verify zero requests to external APIs for generation. Verify data persists in MMKV only.

### Tests for User Story 5 (REQUIRED) ⚠️

- [ ] T063 [P] [US5] Regression test: verify no imports of reflection/review/onboarding remain in bundle (grep sweep in CI script)
- [ ] T064 [P] [US5] Integration test: verify local-ai-runtime makes no HTTP/fetch calls during generateCompletion (mock network, verify no requests)

### Implementation for User Story 5

- [ ] T065 [US5] Audit `local-ai-runtime.ts` — confirm no fetch/axios/http imports, only native llama.rn calls (document in PR notes)
- [ ] T066 [US5] Audit chat-service — confirm MMKV-only persistence, no cloud sync, no analytics/tracking of message content
- [ ] T067 [US5] Add CI grep-sweep script to `package.json` (verify no `import.*reflection`, `import.*review`, `import.*onboarding` in src/)
- [ ] T068 [US5] Document privacy guarantees in `specs/002-ai-chat-app/quickstart.md` (no external calls, local-only storage, model runs on-device)

**Checkpoint**: Privacy guarantees verified and tested. No external data leakage possible during generation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [ ] T069 [P] E2E test: full user journey (open app → download model → chat → verify history → rename → delete) in `tests/e2e/chat/chat-journey.e2e.spec.ts`
- [ ] T070 [P] Update `QWEN.md` and project README with new chat app structure and quickstart instructions
- [ ] T071 Run full test suite (`npm test`) — all tests must pass
- [ ] T072 Run TypeScript check (`npx tsc --noEmit`) — zero errors
- [ ] T073 Performance profiling summary: record first-token latency, streaming latency, history render time (attach to PR)
- [ ] T074 Clean up any unused imports, dead code, or console.log statements
- [ ] T075 Verify accessibility: all inputs have labels, contrast meets WCAG AA, error states have descriptive text

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - User stories can proceed sequentially (P1 → P2 → P3 → P1(privacy) → P3)
  - Or in parallel if team capacity allows (US1 + US2 share Phase 3 priority, US3+US4 independent)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependencies on other stories → MVP
- **User Story 2 (P1)**: After Foundational — integrates with US1 (model loading enables chat)
- **User Story 5 (P1)**: After US1 — audits existing US1 implementation for privacy compliance
- **User Story 3 (P2)**: After Foundational — depends on chat-service (T010) but not on US1/US2 screens
- **User Story 4 (P3)**: After US3 — depends on history screen existing (T047)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/types before services
- Services before view-models
- View-models before screens
- Core implementation before polish states
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T002, T003, T005, T007 can run in parallel
- Phase 2: T008, T009, T011, T012, T013, T014, T015, T016, T017 can run in parallel (different files)
- Phase 3: T018, T019, T020 can run in parallel (test writing)
- Phase 4: T031, T032, T033 can run in parallel (test writing)
- Phase 5: T044, T045, T046 can run in parallel (test writing)
- Phase 8: T069, T070 can run in parallel (E2E + docs)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for useChatVm sendMessage flow" (T018)
Task: "Integration test for load-model → generate → save flow" (T019)
Task: "Unit test for ChatMessage validation" (T020)

# After tests pass, launch implementation:
Task: "Create use-chat-vm.ts" (T021)
Task: "Wire sendMessage to local-ai-runtime" (T022)
Task: "Create chat screen index.tsx" (T024)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (remove legacy, create routes)
2. Complete Phase 2: Foundational (entities, storage, UI primitives)
3. Complete Phase 3: User Story 1 (chat with streaming)
4. **STOP and VALIDATE**: Test chat flow independently
5. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Chat with streaming → MVP!
3. US2 → Model download in-chat → Full self-service
4. US3 → History → Conversation continuity
5. US4 → Rename/delete → Long-term organization
6. US5 → Privacy audit → Trust guarantee
7. Polish → E2E, docs, performance validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (chat)
   - Developer B: User Story 2 (model picker) + User Story 5 (privacy)
   - Developer C: User Story 3 (history) → User Story 4 (management)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [US1]-[US5] labels map task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Include UX consistency checks and performance verification for each story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Avoid**: vague tasks, same file conflicts, cross-story dependencies that break independence
