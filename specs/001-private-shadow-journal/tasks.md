# Tasks: Private Shadow Reflection Journal

**Input**: Design documents from `/specs/001-private-shadow-journal/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are REQUIRED for each user story and for cross-cutting risk areas.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and baseline structure for feature-based MVVM, Bun workflow, and shared UI foundations.

- [x] T001 Create reflection route shells in app/(reflection)/daily.tsx, app/(reflection)/review.tsx, and app/(reflection)/export.tsx
- [ ] T002 Configure Bun-focused scripts in package.json
- [ ] T003 [P] Configure test runner and setup in jest.config.ts and **tests**/setup.ts
- [ ] T004 [P] Create documentation scaffold in **docs**/architecture/README.md, **docs**/decisions/README.md, and **docs**/quality/README.md
- [ ] T005 [P] Create feature module barrel files in features/reflection/index.ts, features/review/index.ts, and features/export/index.ts
- [ ] T006 [P] Create reusable async state component in shared/components/state-view.tsx
- [ ] T007 [P] Define shared error/result types in shared/utils/app-error.ts
- [ ] T008 [P] Add reflection UI token mapping in shared/theme/reflection-theme.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core local AI, security, persistence, and orchestration foundations required by all stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 Implement encrypted reflection storage adapter in shared/storage/encrypted-reflection-store.ts
- [ ] T010 [P] Implement app lock gateway and hook in shared/security/app-lock.ts and shared/security/use-app-lock.ts
- [ ] T011 [P] Implement local llama.rn runtime bootstrap service in shared/ai/local-ai-runtime.ts
- [ ] T012 [P] Implement RAG vector repository wrapper in shared/ai/reflection-rag-repository.ts
- [ ] T013 Implement Portuguese fallback prompt provider in shared/ai/fallback-prompts-ptbr.ts
- [ ] T014 Implement retry job persistence in shared/storage/generation-job-store.ts
- [ ] T015 Implement queued retry worker in shared/ai/retry-queue-worker.ts
- [ ] T016 Implement hard-delete cascade coordinator in shared/storage/reflection-cascade-delete.ts
- [ ] T017 Implement pt-BR language and Jungian tone guard utilities in shared/ai/ptbr-tone-guard.ts
- [ ] T018 Implement generation/export timing utility in shared/utils/performance-metrics.ts

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Daily Reflection with Guided Questions (Priority: P1) 🎯 MVP

**Goal**: Let users create private daily reflections and receive context-aware guided questions in Portuguese BR.

**Independent Test**: Create a reflection, generate questions in normal mode, and verify fallback + retry behavior when local generation is unavailable.

### Tests for User Story 1 (REQUIRED)

- [ ] T019 [P] [US1] Add unit tests for reflection validation and language guard in **tests**/unit/reflection/create-reflection.spec.ts
- [ ] T020 [P] [US1] Add integration test for guided question generation in normal mode in **tests**/integration/reflection/guided-questions-normal.spec.ts
- [ ] T021 [P] [US1] Add integration test for fallback prompts plus queued retry in **tests**/integration/reflection/guided-questions-fallback-retry.spec.ts
- [ ] T022 [P] [US1] Add end-to-end daily reflection flow test in **tests**/e2e/reflection/daily-flow.e2e.ts

### Implementation for User Story 1

- [ ] T023 [P] [US1] Implement ReflectionEntry domain model in features/reflection/model/reflection-entry.ts
- [ ] T024 [P] [US1] Implement GuidedQuestionSet domain model in features/reflection/model/guided-question-set.ts
- [ ] T025 [US1] Implement reflection repository adapter in features/reflection/repository/reflection-repository.ts
- [ ] T026 [US1] Implement reflection creation and guided question service in features/reflection/service/reflection-service.ts
- [ ] T027 [US1] Implement hard-delete reflection use case in features/reflection/service/delete-reflection-cascade.ts
- [ ] T028 [US1] Implement daily reflection ViewModel in features/reflection/view-model/use-daily-reflection-vm.ts
- [ ] T029 [US1] Implement daily reflection screen in features/reflection/view/daily-reflection-screen.tsx
- [x] T030 [US1] Wire daily reflection route in app/(reflection)/daily.tsx
- [ ] T031 [US1] Add delete confirmation and action flow in components/DocumentModal.tsx
- [ ] T032 [US1] Wire generation state UX in components/ChatInput.tsx and components/MessagesList.tsx

**Checkpoint**: User Story 1 is fully usable and independently testable.

---

## Phase 4: User Story 2 - Period Review and Shadow Pattern Synthesis (Priority: P2)

**Goal**: Generate period-based final reviews with recurring patterns and introspective prompts.

**Independent Test**: Seed period data, generate review, verify low-data behavior, and validate Portuguese BR output/tone.

### Tests for User Story 2 (REQUIRED)

- [ ] T033 [P] [US2] Add unit tests for period input validation in **tests**/unit/review/period-validation.spec.ts
- [ ] T034 [P] [US2] Add integration test for normal final review synthesis in **tests**/integration/review/final-review-normal.spec.ts
- [ ] T035 [P] [US2] Add integration test for constrained low-data review response in **tests**/integration/review/final-review-low-data.spec.ts
- [ ] T036 [P] [US2] Add end-to-end period review flow test in **tests**/e2e/review/period-review-flow.e2e.ts

### Implementation for User Story 2

- [ ] T037 [P] [US2] Implement FinalReview domain model in features/review/model/final-review.ts
- [ ] T038 [US2] Implement period review repository queries in features/review/repository/review-repository.ts
- [ ] T039 [US2] Implement final review generation service in features/review/service/review-service.ts
- [ ] T040 [US2] Implement period review ViewModel in features/review/view-model/use-period-review-vm.ts
- [ ] T041 [US2] Implement period review screen in features/review/view/period-review-screen.tsx
- [ ] T042 [US2] Implement queued-retry status banner in features/review/view/retry-status-banner.tsx
- [x] T043 [US2] Wire period review route in app/(reflection)/review.tsx

**Checkpoint**: User Story 2 is independently testable and functional.

---

## Phase 5: User Story 3 - Markdown Export of Reflection History (Priority: P3)

**Goal**: Export selected reflections and generated artifacts into structured markdown.

**Independent Test**: Export for populated and empty ranges; verify markdown structure, ordering, and no-content handling.

### Tests for User Story 3 (REQUIRED)

- [ ] T044 [P] [US3] Add unit tests for markdown formatter ordering rules in **tests**/unit/export/markdown-formatter.spec.ts
- [ ] T045 [P] [US3] Add integration test for markdown bundle generation in **tests**/integration/export/markdown-export.spec.ts
- [ ] T046 [P] [US3] Add integration test for empty-period no-content handling in **tests**/integration/export/markdown-empty-period.spec.ts
- [ ] T047 [P] [US3] Add end-to-end export flow test in **tests**/e2e/export/export-flow.e2e.ts

### Implementation for User Story 3

- [ ] T048 [P] [US3] Implement ExportBundle domain model in features/export/model/export-bundle.ts
- [ ] T049 [US3] Implement markdown export service in features/export/service/markdown-export-service.ts
- [ ] T050 [US3] Implement export repository and file writer in features/export/repository/export-repository.ts
- [ ] T051 [US3] Implement export ViewModel in features/export/view-model/use-export-vm.ts
- [ ] T052 [US3] Implement export screen UI in features/export/view/export-screen.tsx
- [x] T053 [US3] Wire export route in app/(reflection)/export.tsx

**Checkpoint**: User Story 3 is independently testable and functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across privacy, quality, performance, and documentation.

- [ ] T054 [P] Add regression suite for privacy/language/deletion risks in **tests**/integration/regression/privacy-language-delete.spec.ts
- [ ] T055 [P] Document feature architecture and MVVM boundaries in **docs**/architecture/private-shadow-journal.md
- [ ] T056 [P] Create ADR for local-only AI + Bun + feature-based MVVM in **docs**/decisions/0001-local-ai-mvvm-bun.md
- [ ] T057 Validate performance budgets and record measurements in **docs**/quality/performance-validation.md
- [ ] T058 Update quickstart validation notes in **docs**/quality/quickstart-validation.md and specs/001-private-shadow-journal/quickstart.md
- [ ] T059 Wire reflection feature route entry points in app/\_layout.tsx
- [ ] T060 Record release readiness evidence (lint, tests, security gates) in **docs**/quality/release-readiness.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): starts immediately.
- Foundational (Phase 2): depends on Setup; blocks all user stories.
- User Stories (Phases 3-5): depend on Foundational.
- Polish (Phase 6): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): starts after Foundational; no dependency on US2/US3.
- US2 (P2): starts after Foundational; can run independently using seeded reflection fixtures.
- US3 (P3): starts after Foundational; can run independently using seeded reflection and review fixtures.

### Within Each User Story

- Tests first, must fail before implementation.
- Models before repositories/services.
- Services before view-model.
- View-model before views/routes.
- Story verified before checkpoint.

### Parallel Opportunities

- Setup tasks marked [P] can run in parallel.
- Foundational tasks marked [P] can run in parallel after T009 baseline starts.
- Story test tasks marked [P] can run in parallel.
- Story model tasks marked [P] can run in parallel.
- Different user stories can be implemented in parallel after Foundational completion.

---

## Parallel Example: User Story 1

```bash
Task: "T019 [US1] __tests__/unit/reflection/create-reflection.spec.ts"
Task: "T020 [US1] __tests__/integration/reflection/guided-questions-normal.spec.ts"
Task: "T021 [US1] __tests__/integration/reflection/guided-questions-fallback-retry.spec.ts"
Task: "T023 [US1] features/reflection/model/reflection-entry.ts"
Task: "T024 [US1] features/reflection/model/guided-question-set.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Finish Phase 1.
2. Finish Phase 2.
3. Finish Phase 3 (US1).
4. Validate US1 independently before expanding scope.

### Incremental Delivery

1. Setup + Foundational -> platform ready.
2. Deliver US1 -> validate -> demo.
3. Deliver US2 -> validate -> demo.
4. Deliver US3 -> validate -> demo.
5. Complete polish and final readiness checks.

### Parallel Team Strategy

1. Team aligns on Setup + Foundational.
2. After Foundation:
   - Dev A: US1
   - Dev B: US2
   - Dev C: US3
3. Integrate in Phase 6 with regression and performance validation.

---

## Notes

- [P] means no dependency/conflict with incomplete tasks.
- [USx] labels map each task to its user story.
- Keep generated text and UI copy in Brazilian Portuguese.
- Keep reflection data local-only and enforce hard-delete cascade semantics.
- Use Bun commands for execution and **tests**/**docs** as canonical directories.
