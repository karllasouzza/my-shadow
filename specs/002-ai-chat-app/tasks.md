---
description: "Task list for AI Chat App Restructure — regenerated with new architecture"
---

# Tasks: AI Chat App Restructure

**Input**: Design documents from `/specs/002-ai-chat-app/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Test tasks are REQUIRED for each user story and cross-cutting risk areas.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1=Chat, US2=Model Mgmt, US3=History, US4=Manage, US5=Privacy
- Include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Remove onboarding feature entirely, clean up deprecated files, create new shared/ai/ structure, update route group.

- [ ] T001 [P] Delete `features/onboarding/` directory and all subfiles
- [ ] T002 [P] Remove `app/onboarding.tsx` route and any onboarding references from `_layout.tsx`
- [ ] T003 Grep-sweep: verify zero imports of `onboarding`, `reflection`, `review`, `export` in remaining code. Run `npx tsc --noEmit` and `npm test` to confirm clean
- [ ] T004 [P] Move `features/onboarding/service/model-manager.ts` → `shared/ai/model-manager.ts`. Update all import paths across codebase
- [ ] T005 [P] Create `shared/ai/model-catalog.ts` with MODEL_CATALOG array (moved from inline in components)
- [ ] T006 Update `app/_layout.tsx` to only route to `(chat)/` group — remove all legacy screen registrations
- [ ] T007 [P] Delete root `components/chat/`, `components/history/` directories (components move to feature modules)
- [ ] T008 [P] Create feature component directories: `features/chat/components/`, `features/history/components/`, `features/model-management/components/`

**Checkpoint**: Onboarding removed. shared/ai/ owns model lifecycle + catalog. No legacy imports. Feature component dirs ready.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared/ai/ API, co-located component primitives, route structure. MUST complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 [P] Refactor `shared/ai/model-manager.ts` to export clean API: `downloadModel()`, `verifyModel()`, `loadModel()`, `unloadModel()`, `getActiveModel()`, `setActiveModel()`. All use MMKV for persistence
- [ ] T010 [P] Ensure `shared/ai/local-ai-runtime.ts` exports: `initialize()`, `loadModel()`, `generateCompletion()`, `tokenize()`, `isModelLoaded()`, `getCurrentModel()`, `unloadModel()`, `getStatus()`
- [ ] T011 [P] Create `features/chat/model/chat-conversation.ts` with ChatConversation + ChatConversationIndex types (if not already present)
- [ ] T012 [P] Create `features/chat/model/chat-message.ts` with ChatMessage type + validation (if not already present)
- [ ] T013 [P] Create `features/chat/components/model-badge.tsx` — shows loaded model name (green) or "Sem modelo" (yellow). Tap triggers onPress callback
- [ ] T014 [P] Create `features/chat/components/empty-chat.tsx` — friendly empty state with "Inicie uma conversa" text
- [ ] T015 [P] Create `features/history/components/empty-history.tsx` — empty state with "Nenhuma conversa ainda" text
- [ ] T016 [P] Create `features/model-management/components/model-item.tsx` — single model row with download/load status, size, RAM info, action button
- [ ] T017 [P] Create `features/model-management/components/download-progress.tsx` — progress bar + percentage for active download
- [ ] T018 [P] Create `features/model-management/components/ram-warning.tsx` — yellow warning banner when device RAM < model estimate

**Checkpoint**: shared/ai/ API ready. Component primitives in place. Route structure clean. User story implementation can now begin.

---

## Phase 3: User Story 1 — Start a New Chat Conversation (Priority: P1) 🎯 MVP

**Goal**: User opens app, sees chat screen, sends message, receives streaming AI response (model already loaded).

**Independent Test**: Open chat → send message → see response tokens stream progressively.

### Tests for User Story 1

- [ ] T019 [P] [US1] Unit test for `useChatVm.sendMessage()` with mocked generateCompletion in `tests/unit/chat/use-chat-vm.spec.ts`
- [ ] T020 [P] [US1] Unit test for `ChatMessage` validation in `tests/unit/chat/chat-message.spec.ts`
- [ ] T021 [P] [US1] Integration test: sendMessage → generateCompletion → saveConversation in `tests/integration/chat/chat-flow.spec.ts`

### Implementation for User Story 1

- [ ] T022 [US1] Create `features/chat/view-model/use-chat-vm.ts` with Legend State: currentConversation, isModelReady, isGenerating, streamingText, errorMessage, showCancelOption. Implement `sendMessage()`, `cancelGeneration()`, `syncModelStatus()`, `resetChatState()`
- [ ] T023 [US1] Wire `sendMessage()` in useChatVm to `shared/ai/local-ai-runtime.generateCompletion()` with onToken callback for progressive token display
- [ ] T024 [US1] Implement context window validation in useChatVm (call runtime.tokenize(), compare to n_ctx - reserved, block send if exceeded)
- [ ] T025 [US1] Create `features/chat/components/chat-input.tsx` with text input, send button, disabled state when !isModelReady or isGenerating, accessibility labels
- [ ] T026 [US1] Create `features/chat/components/message-bubble.tsx` with user/assistant/system variants using NativeWind tokens. Include timestamp display
- [ ] T027 [US1] Create `features/chat/components/generating-indicator.tsx` — spinner + "Pensando..." text during generation
- [ ] T028 [US1] Create `features/chat/view/chat-screen.tsx` — FlatList bound to messages observable, ChatInput, ModelBadge, GeneratingIndicator, EmptyChatState. KeyboardAvoidingView. Auto-scroll on new messages + streaming
- [ ] T029 [US1] Create `app/(chat)/index.tsx` that imports and renders ChatScreen. Add history button (clock icon) in header → `router.push("/(chat)/history")`
- [ ] T030 [US1] Wire chat-service save: after user message sent AND after assistant response received, call `chat-service.appendUserMessage()` / `appendAssistantMessage()`
- [ ] T031 [US1] Auto-generate conversation title from first user message (truncate to 50 chars) on first send via `chat-service`
- [ ] T032 [US1] Add cancel generation button visible after 30s of generation (PF-005) — calls `cancelGeneration()` in useChatVm
- [ ] T033 [US1] Define all 6 UX states in chat-screen: empty, no model loaded, model loading, generating, error, populated. Each renders appropriate component

**Checkpoint**: US1 fully functional — user can chat with streaming response, messages persist, cancel works. MVP deliverable.

---

## Phase 4: User Story 2 — Manage AI Models (Priority: P1)

**Goal**: User navigates to Model Management screen, browses catalog, downloads models, loads/unloads models. Active model persists between sessions.

**Independent Test**: Open models screen → select model → download → load → verify chat recognizes active model.

### Tests for User Story 2

- [ ] T034 [P] [US2] Unit test for `useModelsVm` browse/download/load flow in `tests/unit/model-management/use-models-vm.spec.ts`
- [ ] T035 [P] [US2] Unit test for `shared/ai/model-manager.downloadModel()` with progress callback in `tests/unit/model-management/model-manager.spec.ts`
- [ ] T036 [P] [US2] Integration test: download → verify → load chain in `tests/integration/model-management/model-flow.spec.ts`

### Implementation for User Story 2

- [ ] T037 [US2] Create `features/model-management/view-model/use-models-vm.ts` with Legend State: catalog, downloadedModels, activeModel, isLoading, downloadProgress, errorMessage. Implement `browseModels()`, `downloadModel()`, `loadModel()`, `unloadModel()`, `refreshStatus()`
- [ ] T038 [US2] Wire `useModelsVm.downloadModel()` to `shared/ai/model-manager.downloadModel()` with progress callback that updates downloadProgress observable
- [ ] T039 [US2] Wire `useModelsVm.loadModel()` to `shared/ai/model-manager.loadModel()` + `setActiveModel()`. Update chat screen's isModelReady after load
- [ ] T040 [US2] Implement disk space validation before download (FR-014): check expo-file-system available storage vs model fileSizeBytes
- [ ] T041 [US2] Implement RAM warning before load (FR-015): compare model estimatedRamBytes to device RAM via react-native-device-info
- [ ] T042 [US2] Create `features/model-management/components/model-catalog.tsx` — FlatList of ModelItem components, empty state when no models, loading state during catalog fetch
- [ ] T043 [US2] Create `features/model-management/view/models-screen.tsx` — header with back button, ModelCatalog, DownloadProgress overlay, RAMWarning modal. All 5 UX states: no models, browsing, downloading, loading, failed
- [ ] T044 [US2] Create `app/(chat)/models.tsx` that imports and renders ModelsScreen. Stack-pushed from chat header
- [ ] T045 [US2] Wire model badge in chat header to open models screen via `router.push("/(chat)/models")`
- [ ] T046 [US2] Implement active model persistence: on app launch, call `shared/ai/model-manager.getActiveModel()` → auto-load if localPath exists → update chat isModelReady

**Checkpoint**: US1 + US2 both work — user can manage models independently, chat recognizes loaded model, active model persists between sessions.

---

## Phase 5: User Story 3 — View and Resume Chat History (Priority: P2)

**Goal**: User navigates to History screen from chat header, sees list of past conversations, taps to resume any conversation.

**Independent Test**: Create conversation → open history → see it listed → tap → return to chat with full message history.

### Tests for User Story 3

- [ ] T047 [P] [US3] Unit test for `useHistoryVm` list/load in `tests/unit/history/use-history-vm.spec.ts`
- [ ] T048 [P] [US3] Unit test for `chat-service.listConversations()` + `loadConversation()` in `tests/unit/history/chat-service.spec.ts`
- [ ] T049 [P] [US3] Integration test: history navigation flow in `tests/integration/history/history-flow.spec.ts`

### Implementation for User Story 3

- [ ] T050 [US3] Create `features/history/view-model/use-history-vm.ts` with Legend State: conversations (index list), isLoading, errorMessage. Implement `loadConversations()`, `loadFullConversation()`, `refreshList()`
- [ ] T051 [US3] Wire `loadConversations()` to `chat-service.listConversations()` (reads MMKV index, sorts by updatedAt desc)
- [ ] T052 [US3] Wire `loadFullConversation()` to `chat-service.loadConversation()` (reads full `chat:{id}` from MMKV)
- [ ] T053 [US3] Create `features/history/components/conversation-list.tsx` — FlatList of ConversationItem components, pull-to-refresh
- [ ] T054 [US3] Create `features/history/components/conversation-item.tsx` — shows title + formatted date (e.g., "2h atrás", "3d atrás"). Tap → navigate to chat with conversation loaded. Long-press → action sheet (Phase 6)
- [ ] T055 [US3] Create `features/history/view/history-screen.tsx` — header with back button, ConversationList or EmptyHistoryState, loading spinner. Auto-refresh on focus via useFocusEffect
- [ ] T056 [US3] Create `app/(chat)/history.tsx` that imports and renders HistoryScreen. Stack-pushed from chat header clock icon
- [ ] T057 [US3] Wire history tap → pop stack → load conversation into chat screen's messages observable via `useChatVm.loadConversation(id)`

**Checkpoint**: US1 + US2 + US3 all work — user can chat, manage models, and resume past conversations independently.

---

## Phase 6: User Story 4 — Manage Chat Conversations (Priority: P3)

**Goal**: User can rename and delete conversations from history screen with confirmation dialogs.

**Independent Test**: Rename conversation → see new title. Delete conversation → confirmation → verify removal from list + MMKV.

### Tests for User Story 4

- [ ] T058 [P] [US4] Unit test for `chat-service.renameConversation()` in `tests/unit/history/chat-service.spec.ts`
- [ ] T059 [P] [US4] Unit test for `chat-service.deleteConversation()` (cascade removal) in `tests/unit/history/chat-service.spec.ts`

### Implementation for User Story 4

- [ ] T060 [US4] Implement rename flow in history-screen: long-press conversation → Alert.prompt for new title → validate ≤100 chars → call `chat-service.renameConversation()` → refresh list
- [ ] T061 [US4] Implement delete flow in history-screen: long-press → Alert.alert confirmation → call `chat-service.deleteConversation()` → remove from MMKV + index → refresh list
- [ ] T062 [US4] Update `useHistoryVm` with `renameConversation()` and `deleteConversation()` actions that wrap service calls and refresh list on success
- [ ] T063 [US4] Handle edge case: user deletes conversation currently open in chat screen → reset chat state to empty (new conversation)

**Checkpoint**: All 4 user stories independently functional — full chat, model management, history, and conversation management.

---

## Phase 7: User Story 5 — Privacy-First Local Processing (Priority: P1)

**Goal**: Verify and document that all processing is local — no external network calls for generation, all data persists on-device only.

**Independent Test**: Monitor network traffic during chat session → zero requests to external APIs for generation. Verify data persists in MMKV only.

### Tests for User Story 5

- [ ] T064 [P] [US5] Regression test: grep-sweep for forbidden imports (no `fetch`, `axios`, `XMLHttpRequest` in chat-service, no cloud sync libs) in CI script
- [ ] T065 [P] [US5] Integration test: verify local-ai-runtime makes no HTTP/fetch calls during generateCompletion (mock network layer, verify zero requests)

### Implementation for User Story 5

- [ ] T066 [US5] Audit `shared/ai/local-ai-runtime.ts` — confirm no fetch/axios/http imports, only native llama.rn calls. Document findings in PR notes
- [ ] T067 [US5] Audit `features/chat/service/chat-service.ts` — confirm MMKV-only persistence, no cloud sync, no analytics/tracking of message content. Document in PR notes
- [ ] T068 [US5] Add CI grep-sweep script to `package.json` scripts field: `"lint:imports": "grep -rn 'from.*fetch\\|from.*axios\\|from.*XMLHttpRequest' src/shared/ai/ src/features/chat/"` (fail on matches)
- [ ] T069 [US5] Document privacy guarantees in `specs/002-ai-chat-app/quickstart.md` — "No external calls, local-only storage, model runs on-device"

**Checkpoint**: Privacy guarantees verified and tested. No external data leakage possible during generation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [ ] T070 [P] E2E test: full user journey (open app → navigate to models → download → load → chat → verify history → rename → delete) in `tests/e2e/chat/chat-journey.e2e.spec.ts`
- [ ] T071 [P] Audit ALL remaining files in `features/`, `shared/`, `components/`, `app/` for unused imports, dead code, console.log statements. Remove or fix
- [ ] T072 Run full test suite (`npm test`) — all tests must pass
- [ ] T073 Run TypeScript check (`npx tsc --noEmit`) — zero errors
- [ ] T074 Update `QWEN.md` and project README with new architecture (3-screen model, shared/ai ownership, co-located components)
- [ ] T075 Performance profiling: record first-token latency, streaming latency, history render time on 4GB RAM device. Attach results to PR
- [ ] T076 Verify accessibility: all inputs have labels, contrast meets WCAG AA, error states have descriptive text across all 3 screens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel after Foundational
  - US3 (P2) depends on US1 (chat-service must exist for history to load conversations)
  - US4 (P3) depends on US3 (history screen must exist for rename/delete)
  - US5 (P1) depends on US1 (audit chat-service after it's built)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational)
                        │
              ┌─────────┼──────────┐
              ▼         ▼          ▼
           US1(Chat)  US2(Models)  US5(Privacy, after US1)
              │
              ▼
           US3(History)
              │
              ▼
           US4(Manage)
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before services
- Services before view-models
- View-models before screens
- Core implementation before polish states
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T001, T002, T004, T005, T007, T008 all parallelizable
- Phase 2: T009-T018 all parallelizable (different files, no cross-deps)
- Phase 3: T019, T020, T021 parallelizable (test writing)
- Phase 4: T034, T035, T036 parallelizable (test writing)
- Phase 5: T047, T048, T049 parallelizable (test writing)
- Phase 8: T070, T071, T074 parallelizable (E2E + audit + docs)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "Unit test for useChatVm.sendMessage()" (T019)
Task: "Unit test for ChatMessage validation" (T020)
Task: "Integration test: sendMessage flow" (T021)

# After tests pass, launch implementation in parallel:
Task: "Create use-chat-vm.ts" (T022)
Task: "Create chat-input.tsx" (T025)
Task: "Create message-bubble.tsx" (T026)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (remove onboarding, clean legacy, create dirs)
2. Complete Phase 2: Foundational (shared/ai API, component primitives)
3. Complete Phase 3: User Story 1 (chat with streaming)
4. **STOP and VALIDATE**: Test chat flow independently
5. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Chat with streaming → MVP!
3. US2 → Model management → Full self-service
4. US3 → History → Conversation continuity
5. US4 → Rename/delete → Long-term organization
6. US5 → Privacy audit → Trust guarantee
7. Polish → E2E, docs, performance validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (chat) → User Story 3 (history) → User Story 4 (manage)
   - Developer B: User Story 2 (model management) + User Story 5 (privacy)
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
- **Architecture rule**: Features NEVER import components from other features. shared/ai/ is the ONLY shared module for AI ops.
