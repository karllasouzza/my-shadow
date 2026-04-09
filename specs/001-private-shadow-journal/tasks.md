# Tasks: Migrate AI Runtime from ExecuTorch to llama.rn

**Input**: Design documents from `/specs/001-private-shadow-journal/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/runtime-interface.md

**Tests**: Test tasks are REQUIRED for each user story and for cross-cutting risk areas. Every
implementation plan MUST include the automated tests needed to validate behavior and prevent
regressions.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US0, US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile app**: Repository root with `shared/`, `features/`, `app/` structure
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 1: Setup (Dependencies & Build Configuration)

**Purpose**: Replace ExecuTorch dependencies with llama.rn and configure build system

- [x] T001 Add llama.rn dependency to package.json and remove react-native-executorch, @react-native-rag/executorch, react-native-executorch-expo-resource-fetcher (keep @react-native-rag/executorch temporarily for embeddings)
- [x] T002 [P] Add llama.rn Expo plugin configuration to app.json with enableEntitlements, forceCxx20, enableOpenCL options
- [x] T003 [P] Add expo-build-properties plugin to app.json with Android ProGuard rules: `-keep class com.rnllama.** { *; }`
- [x] T004 Download llama.rn native artifacts: `node ./node_modules/llama.rn/install/download-native-artifacts.js`
- [x] T005 [P] Run `bun install` and verify no dependency conflicts
- [x] T006 Verify TypeScript compilation passes: `npx tsc --noEmit`
- [x] T007 Verify lint passes: `npm run lint`

**Checkpoint**: Build system configured, llama.rn installed, no type errors

---

## Phase 2: Foundational (Runtime Core Migration)

**Purpose**: Migrate LocalAIRuntimeService internals from ExecuTorch to llama.rn while preserving public API

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 [P] Replace native module loading in shared/ai/local-ai-runtime.ts: remove initExecutorch, TokenizerModule, ExecuTorchLLM imports and replace with llama.rn initLlama import
- [x] T009 [P] Update RuntimeNativeModules interface in shared/ai/local-ai-runtime.ts to reflect llama.rn types (LlamaContext instead of ExecuTorchLLM, remove model presets)
- [x] T010 [P] Update DownloadState interface in shared/ai/local-ai-runtime.ts if needed for llama.rn context tracking
- [x] T011 Rewrite initialize() method in shared/ai/local-ai-runtime.ts: remove initExecutorch call, simplify to just verify llama.rn is available
- [x] T012 Rewrite loadModel() method in shared/ai/local-ai-runtime.ts: replace ExecuTorchLLM instantiation with initLlama({ model: 'file://<path>.gguf', use_mlock: true, n_ctx: 4096, n_gpu_layers: 99 })
- [x] T013 Rewrite resolveModelResource() method in shared/ai/local-ai-runtime.ts: replace model preset mapping with direct file path resolution (remove QWEN2*5*\* preset references)
- [x] T014 Rewrite generateCompletion() method in shared/ai/local-ai-runtime.ts: replace llm.generate() with context.completion({ messages, n_predict, stop }, streamCallback)
- [x] T015 Rewrite tokenize() method in shared/ai/local-ai-runtime.ts: replace TokenizerModule.encode() with context.tokenize()
- [x] T016 Update unloadModel() method in shared/ai/local-ai-runtime.ts: replace llm.unload() with context.release() if needed
- [x] T017 Update isModelLoaded() and getCurrentModel() methods to work with llama.rn context state
- [x] T018 Update getStatus() method to return llama.rn runtime metrics
- [x] T019 Update modelVersion string from "executorch-0.8" to "llama.rn-0.10" in features/reflection/service/reflection-service.ts
- [x] T020 Update modelVersion string from "executorch-0.8" to "llama.rn-0.10" in features/review/service/review-service.ts
- [x] T021 Update modelVersion string from "executorch-0.8" to "llama.rn-0.10" in shared/ai/retry-queue-worker.ts
- [x] T022 Remove ExpoResourceFetcher references from shared/ai/local-ai-runtime.ts (no longer needed with llama.rn file paths)
- [x] T023 Verify TypeScript compilation passes: `npx tsc --noEmit`
- [x] T024 Verify lint passes: `npm run lint`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 0 - Secure Onboarding & Model Loading Flow (Priority: P0) 🎯 MVP

**Goal**: User can download a GGUF model, load it with llama.rn, and pass through the onboarding flow without errors

**Independent Test**: Launch app as first-time user, complete security gate, download model, verify model loads without error code 35, reach main reflection interface

### Tests for User Story 0 (REQUIRED) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T025 [P] [US0] Unit test for llama.rn model loading with mock .gguf file path in tests/unit/onboarding/model-loading.spec.ts
- [x] T026 [P] [US0] Unit test for llama.rn completion generation with mock context in tests/unit/onboarding/model-generation.spec.ts
- [x] T027 [P] [US0] Integration test for model download → load → generate flow in tests/integration/onboarding/model-flow.spec.ts

### Implementation for User Story 0

- [x] T028 [US0] Verify model-manager.ts downloadModel() already downloads .gguf files correctly (no changes needed - GGUF is the correct format for llama.rn)
- [x] T029 [US0] Update use-model-loading-vm.ts to handle llama.rn context loading (verify loadModel() call passes correct file:// URI)
- [x] T030 [US0] Add llama.rn-specific error handling in use-model-loading-vm.ts (catch llama.rn load errors and show user-friendly pt-BR messages)
- [x] T031 [US0] Update model-loading-screen.tsx to display llama.rn loading progress (verify progress bar reflects llama.rn load state)
- [x] T032 [US0] Test model loading with actual .gguf file on target device (Android) - verify no error code 35
- [x] T033 [US0] Validate UX states: loading (spinner + progress), success (checkmark + auto-navigate), error (message + retry/cancel buttons)
- [x] T034 [US0] Verify performance budget: model load <30s for 0.5B Q4 model on mid-tier Android device

**Checkpoint**: At this point, User Story 0 should be fully functional and testable independently

---

## Phase 4: User Story 1 - Daily Reflection with Guided Questions (Priority: P1)

**Goal**: User can create reflections and receive AI-generated guided questions in Brazilian Portuguese with Jungian tone using llama.rn

**Independent Test**: Create reflection entry, request guided questions, verify pt-BR output with introspective tone is generated

### Tests for User Story 1 (REQUIRED) ⚠️

- [x] T035 [P] [US1] Unit test for generateGuidedQuestions() with llama.rn mock in tests/unit/reflection/guided-questions.spec.ts
- [x] T036 [P] [US1] Unit test for Brazilian Portuguese language enforcement in completion output in tests/unit/reflection/language-check.spec.ts
- [x] T037 [P] [US1] Unit test for Jungian tone validation in generated questions in tests/unit/reflection/tone-check.spec.ts
- [x] T038 [P] [US1] Integration test for reflection → guided questions generation flow in tests/integration/reflection/reflection-flow.spec.ts

### Implementation for User Story 1

- [x] T039 [US1] Verify reflection-service.ts generateGuidedQuestions() works with llama.rn context.completion() (update if needed)
- [x] T040 [US1] Verify system prompt enforces Brazilian Portuguese + Jungian tone (update if needed)
- [x] T041 [US1] Verify stop words are appropriate for pt-BR completions (add '</s>', '<|end|>', '\nUser:')
- [x] T042 [US1] Test guided questions generation with llama.rn on target device - verify output is in pt-BR with introspective tone
- [x] T043 [US1] Validate UX states: loading (spinner), success (questions displayed), error (fallback prompts + retry queue)
- [x] T044 [US1] Verify performance budget: guided question generation <8s p95 for 500-word reflection on 8GB device
- [x] T045 [US1] Add regression test for language leakage (ensure no English output in guided questions)

**Checkpoint**: At this point, User Stories 0 AND 1 should both work independently

---

## Phase 5: User Story 2 - Period Review and Shadow Pattern Synthesis (Priority: P2)

**Goal**: User can generate period-based review synthesizing reflections and identifying shadow patterns using llama.rn

**Independent Test**: Load multiple reflections for a date range, generate final review, verify structured pt-BR summary with recurring themes

### Tests for User Story 2 (REQUIRED) ⚠️

- [x] T046 [P] [US2] Unit test for review generation with llama.rn mock in tests/unit/review/period-review.spec.ts
- [x] T047 [P] [US2] Integration test for review generation flow with multiple reflections in tests/integration/review/review-flow.spec.ts
- [x] T048 [P] [US2] Unit test for empty period handling (insufficient material) in tests/unit/review/period-validation.spec.ts

### Implementation for User Story 2

- [x] T049 [US2] Verify review-service.ts generatePeriodReview() works with llama.rn context.completion() (update if needed)
- [x] T050 [US2] Verify review system prompt enforces pt-BR + Jungian shadow-work synthesis tone
- [x] T051 [US2] Test review generation with llama.rn on target device - verify structured pt-BR output with themes/patterns
- [x] T052 [US2] Validate UX states: loading (spinner + progress), success (review displayed), empty (concise message), error (retry option)
- [x] T053 [US2] Verify performance budget: review generation <20s p95 for 30 entries on 8GB device

**Checkpoint**: All user stories 0, 1, AND 2 should now be independently functional

---

## Phase 6: User Story 3 - Markdown Export of Reflection History (Priority: P3)

**Goal**: User can export reflections, guided questions, and reviews to markdown file using content generated by llama.rn

**Independent Test**: Select date range with reflections, generate markdown export, verify file contains timestamps, reflections, questions, and reviews in readable format

### Tests for User Story 3 (REQUIRED) ⚠️

- [x] T054 [P] [US3] Unit test for markdown formatting with llama.rn-generated content in tests/unit/export/markdown-formatter.spec.ts
- [x] T055 [P] [US3] Integration test for full export flow with llama.rn content in tests/integration/export/export-flow.spec.ts
- [x] T056 [P] [US3] Unit test for empty period export handling in tests/unit/export/empty-period.spec.ts

### Implementation for User Story 3

- [x] T057 [US3] Verify export pipeline handles llama.rn-generated content correctly (no format changes expected)
- [x] T058 [US3] Test markdown export with llama.rn-generated reflections and questions on target device
- [x] T059 [US3] Validate UX states: loading (spinner + progress), success (file saved), empty (no-content message), error (retry option)
- [x] T060 [US3] Verify performance budget: markdown export <10s p95 for 365 entries

**Checkpoint**: All user stories 0, 1, 2, AND 3 should now be independently functional

---

## Phase 7: RAG Embeddings (Cross-Cutting Infrastructure)

**Purpose**: Ensure RAG retrieval continues to work with @react-native-rag/executorch embeddings alongside llama.rn LLM

**Note**: This phase ensures rag-content.db vector retrieval works during the transition period

- [x] T061 [P] Verify ReflectionRAGRepository still works with @react-native-rag/executorch embeddings alongside llama.rn LLM in shared/ai/reflection-rag-repository.ts
- [x] T062 [P] Test RAG retrieval + llama.rn generation integration in tests/integration/rag/rag-retrieval.spec.ts
- [x] T063 Verify rag-content.db embeddings are compatible with @react-native-rag/executorch (validate vector dimensions match 384)
- [x] T064 Document future migration path for embeddings from executorch to llama.rn in shared/ai/reflection-rag-repository.ts comments
- [x] T065 Add regression test for RAG retrieval quality before/after llama.rn migration

**Checkpoint**: RAG system verified working with llama.rn LLM + executorch embeddings

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T066 [P] Documentation updates: Update README.md with llama.rn setup instructions
- [x] T067 [P] Update docs/architecture/private-shadow-journal.md to reflect llama.rn runtime
- [x] T068 [P] Update docs/decisions/0001-local-ai-mvvm-bun.md to document migration from ExecuTorch to llama.rn
- [x] T069 Run full test suite and verify all 107 tests pass: `bun test`
- [x] T070 Run full TypeScript check and verify no errors: `npx tsc --noEmit`
- [x] T071 Run lint and verify no errors: `npm run lint`
- [x] T072 [P] Add integration tests for retry queue worker with llama.rn in tests/integration/ai/retry-queue.spec.ts
- [x] T073 Performance benchmark: Document model loading and generation times for each device tier (4GB, 6GB, 8GB RAM)
- [x] T074 [P] Security review: Verify no reflection or generated content is transmitted to external services
- [x] T075 Run quickstart.md validation on clean install

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US0 → US1 → US2 → US3)
- **RAG Embeddings (Phase 7)**: Depends on Foundational + US1 completion
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 0 (P0)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Depends on US0 model loading
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 reflection data
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US1 + US2 generated content

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/services before UI integration
- Core implementation before UX validation
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003, T005)
- All Foundational native module replacements can run in parallel (T008, T009, T010)
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members (after Phase 2)
- Documentation updates can run in parallel (T066, T067, T068)

---

## Parallel Example: User Story 0

```bash
# Launch all tests for User Story 0 together:
Task: "Unit test for llama.rn model loading in tests/unit/onboarding/model-loading.spec.ts"
Task: "Unit test for llama.rn completion generation in tests/unit/onboarding/model-generation.spec.ts"
Task: "Integration test for model download → load → generate flow in tests/integration/onboarding/model-flow.spec.ts"
```

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for generateGuidedQuestions() in tests/unit/reflection/guided-questions.spec.ts"
Task: "Unit test for pt-BR language enforcement in tests/unit/reflection/language-check.spec.ts"
Task: "Unit test for Jungian tone validation in tests/unit/reflection/tone-check.spec.ts"
Task: "Integration test for reflection flow in tests/integration/reflection/reflection-flow.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 0 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 0
4. **STOP and VALIDATE**: Test model download → load → verify no error code 35
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 0 → Test independently → Model loading works! (MVP!)
3. Add User Story 1 → Test independently → Guided questions generated!
4. Add User Story 2 → Test independently → Period reviews work!
5. Add User Story 3 → Test independently → Export pipeline complete!
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 0 (onboarding)
   - Developer B: User Story 1 (reflection)
   - Developer C: User Story 2 (review)
   - Developer D: User Story 3 (export)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Include UX consistency checks and performance verification for each story
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- **Critical**: Verify llama.rn builds correctly on Android before starting Phase 2
- **Critical**: Keep @react-native-rag/executorch for embeddings - do NOT remove until Phase 2 migration
