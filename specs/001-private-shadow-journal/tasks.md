# Tasks: Private Shadow Reflection Journal

**Instructions**:

- Tasks are ordered by dependency. Complete in sequence within each slice.
- Each task is independently testable.
- Mark tasks as `[x]` when complete.
- Run tests after each task or logical group.

---

## Slice 0: Foundation & Fixes (Blocking Prerequisites)

_These tasks unblock all other work. Complete first._

- [ ] **T001** — Mount ThemeProvider in `_layout.tsx`
  - Wrap `<Stack>` with `<ThemeProvider>` in `app/_layout.tsx`
  - Verify theme tokens resolve correctly in existing screens
  - **Validation**: `bun run lint` passes, existing screens render with correct theme
  - **Depends on**: nothing

- [ ] **T002** — Add `expo-sqlite` dependency
  - `npx expo install expo-sqlite`
  - Verify TypeScript types are available
  - **Validation**: `import * as SQLite from 'expo-sqlite'` compiles without error
  - **Depends on**: nothing

- [ ] **T003** — Migrate ReviewRepository from in-memory Map to expo-sqlite
  - Replace Map-based storage with SQLite table (`final_reviews`)
  - Schema: id (PK), period_start, period_end, summary (TEXT), recurring_patterns (JSON), trigger_themes (JSON), next_inquiry_prompts (JSON), reflection_ids (JSON), source, generated_at
  - Implement `initReviewRepository()` to create table on first use
  - Keep same public API (`getById`, `getByPeriod`, `getByReflectionId`, `save`, `delete`, `listAll`, `clear`)
  - **Validation**: Existing review tests pass; manual test: create review → restart app → review persists
  - **Depends on**: T002

- [ ] **T004** — Initialize ReviewRepository on app startup
  - Call `initReviewRepository()` in app initialization (e.g., `_layout.tsx` or review feature entry)
  - Ensure table exists before any review operation
  - **Validation**: No "table not found" errors when using review feature
  - **Depends on**: T003

- [ ] **T005** — Wire `app/review.tsx` to review feature screen
  - Replace placeholder `<Text>Period Review (placeholder)</Text>` with import of `PeriodReviewScreen` from `features/review`
  - **Validation**: Navigate to `/review` → full period review screen renders
  - **Depends on**: T001 (theme consistency)

- [ ] **T006** — Wire `app/export.tsx` to export feature screen
  - Replace placeholder `<Text>Export Reflections (placeholder)</Text>` with import of `ExportScreen` from `features/export`
  - **Validation**: Navigate to `/export` → full export screen renders
  - **Depends on**: T001 (theme consistency)

**Slice 0 checkpoint**: All existing features (reflection, review, export) are functional with proper persistence and theming.

---

## Slice 1: Onboarding — Security Gate (US-0, Screen 1)

_Implements the authentication gate. All users pass through here first._

- [ ] **T007** — Create `UserCredential` model
  - File: `features/onboarding/model/user-credential.ts`
  - Define `UserCredential` interface (passwordHash, passwordSalt, biometricEnabled, isFirstLaunch, createdAt, lastAuthenticatedAt)
  - Add validation functions (`validatePassword`, `hashPassword`)
  - **Validation**: Unit tests for password validation (min 6 chars, hash is deterministic)
  - **Depends on**: nothing

- [ ] **T008** — Create CredentialRepository
  - File: `features/onboarding/repository/credential-repository.ts`
  - MMKV encrypted instance (`auth_credentials` with AES-256)
  - Methods: `save`, `get`, `isFirstLaunch`, `setFirstLaunchComplete`, `isBiometricEnabled`, `setBiometricEnabled`, `verifyPassword`
  - **Validation**: Integration test — save credential → restart (simulate) → retrieve and verify
  - **Depends on**: T007

- [ ] **T009** — Create Security Gate ViewModel
  - File: `features/onboarding/view-model/use-security-gate-vm.ts`
  - State: mode (firstTime/returning), password input, confirm password, biometric toggle, loading, error
  - Actions: `createPassword`, `authenticatePassword`, `authenticateBiometric`, `enableBiometric`, `clearError`
  - Uses `expo-local-authentication` for biometric
  - **Validation**: Unit tests for state transitions and error handling
  - **Depends on**: T008

- [ ] **T010** — Create Security Gate Screen
  - File: `features/onboarding/view/security-gate-screen.tsx`
  - First-time: password input + confirm + optional biometric enrollment toggle
  - Returning: password input OR biometric prompt (if enrolled)
  - Uses existing `Button`, `Text`, `StateView` components with NativeWind className
  - All text in Brazilian Portuguese
  - **Validation**: Manual test on Android — create password → authenticate → success callback fires
  - **Depends on**: T009

- [ ] **T011** — Add `react-native-device-info` dependency
  - `npx expo install react-native-device-info` (requires prebuild for native module)
  - Used for total RAM detection in device detection service
  - **Validation**: `DeviceInfo.getTotalMemory()` returns valid number on Android
  - **Depends on**: nothing

- [ ] **T012** — Create DeviceDetector service
  - File: `features/onboarding/service/device-detector.ts`
  - Detect total RAM via `react-native-device-info`
  - Detect available storage via `expo-file-system` `Paths.availableDiskSpace`
  - Detect biometric capabilities via `expo-local-authentication`
  - Compute `DeviceInfo` object with `ramBudget60`
  - **Validation**: Unit tests with mocked device info; manual test on Android device
  - **Depends on**: T011

**Slice 1 checkpoint**: Security Gate screen is functional. User can create password on first launch or authenticate on returning. Device detection works.

---

## Slice 2: Onboarding — Model Selection & Download (US-0, Screen 2)

_Shown only when no model is downloaded. Allows browsing, selecting, and downloading LLM models._

- [ ] **T013** — Create `ModelConfiguration` and `AvailableModel` models
  - Files: `features/onboarding/model/model-configuration.ts`, `features/onboarding/model/available-model.ts`
  - Define `ModelConfiguration` interface (id, displayName, modelKey, filePath, fileSizeBytes, estimatedRamBytes, downloadStatus, downloadProgress, isLoaded, lastUsedAt, customFolderUri)
  - Define `AvailableModel` catalog (3 Qwen 2.5 models with URLs, sizes, RAM estimates)
  - Add `isCompatible(ramBudget60)` and `isRecommended` computation
  - **Validation**: Unit tests for compatibility filtering
  - **Depends on**: T012 (device detector for ramBudget60)

- [ ] **T014** — Create ModelRepository
  - File: `features/onboarding/repository/model-repository.ts`
  - MMKV instance (`model_config`) — no encryption needed (paths only, no PII)
  - Methods: `saveActiveModel`, `getActiveModel`, `hasDownloadedModel`, `clearActiveModel`
  - **Validation**: Integration test — save model config → retrieve → fields match
  - **Depends on**: T013

- [ ] **T015** — Create ModelManager service
  - File: `features/onboarding/service/model-manager.ts`
  - Methods: `downloadModel(url, path, onProgress)`, `verifyModel(filePath)`, `loadModel(modelKey, filePath)`, `getModelList()`, `cancelDownload()`
  - Uses `expo-file-system` `File.downloadFileAsync` for downloads
  - Progress callback for UI updates
  - Default storage path: `Paths.document + 'models/'`
  - Optional: SAF folder selection via `StorageAccessFramework.requestDirectoryPermissionsAsync()`
  - **Validation**: Unit tests with mocked filesystem; manual test: download small file with progress
  - **Depends on**: T013, T012

- [ ] **T016** — Create Model Selection ViewModel
  - File: `features/onboarding/view-model/use-model-selection-vm.ts`
  - State: compatible models list, selected model, download progress, loading, error
  - Actions: `selectModel`, `startDownload`, `cancelDownload`, `retryDownload`, `selectCustomFolder`
  - Filters `AvailableModel` catalog by `DeviceInfo.ramBudget60`
  - **Validation**: Unit tests for filtering logic and download state machine
  - **Depends on**: T014, T015

- [ ] **T017** — Create Model Selection Screen
  - File: `features/onboarding/view/model-selection-screen.tsx`
  - Lists compatible models with name, description, size, RAM estimate
  - Recommended model highlighted
  - Incompatible models shown disabled with reason
  - Download progress bar with cancel button
  - Optional: "Choose custom folder" button (SAF)
  - All text in Brazilian Portuguese
  - Uses `usePreventRemove` during active download to block back button
  - **Validation**: Manual test — select model → download → progress updates → completion callback fires
  - **Depends on**: T016

**Slice 2 checkpoint**: User can browse compatible models, download one, and have it persisted. Download can be cancelled and retried.

---

## Slice 3: Onboarding — Model Loading (US-0, Screen 3)

_Mandatory screen that loads the model into memory. Blocks access to app until successful._

- [ ] **T018** — Create Model Loading ViewModel
  - File: `features/onboarding/view-model/use-model-loading-vm.ts`
  - State: loadStatus ('loading' | 'success' | 'failed'), loadProgress, errorMessage
  - Actions: `loadModel`, `retryLoad`, `cancel`
  - Integrates with existing `LocalAIRuntimeService` from `shared/ai/local-ai-runtime.ts`
  - Validates model fits within 60% RAM budget before loading
  - **Validation**: Unit tests for load state machine and budget validation
  - **Depends on**: T014, T015

- [ ] **T019** — Create Model Loading Screen
  - File: `features/onboarding/view/model-loading-screen.tsx`
  - Shows progress indicator during load
  - `usePreventRemove` blocks back button during loading
  - On failure: error message + retry button + cancel button (with confirmation dialog)
  - On success: brief success state → auto-navigate to main app
  - Uses existing `StateView` for loading/error states
  - All text in Brazilian Portuguese
  - **Validation**: Manual test — load model → success → navigates to reflection screen; simulate failure → retry works
  - **Depends on**: T018

- [ ] **T020** — Create onboarding routing guard
  - File: `features/onboarding/service/onboarding-guard.ts` or in `_layout.tsx`
  - On app launch: check `CredentialRepository.isFirstLaunch()` and `ModelRepository.hasDownloadedModel()`
  - Route logic:
    - First launch → Security Gate
    - Returning, no model → Model Selection
    - Returning, has model → Model Loading
    - Both complete → Main app
  - Use `router.replace()` to prevent back navigation to onboarding
  - **Validation**: E2E test — kill app mid-onboarding → reopen → resumes at correct screen
  - **Depends on**: T010, T017, T019

**Slice 3 checkpoint**: Complete onboarding flow works: Security Gate → Model Selection → Model Loading → Main App. Back button is properly blocked during loading.

---

## Slice 4: RAG Database Seed (FR-003)

_Sets up rag-content.db using expo-sqlite with seed data on first launch._

- [ ] **T021** — Create rag-content.db seed service
  - File: `shared/ai/rag-content-seed.ts`
  - Use `expo-sqlite` to create vector store schema
  - Define seed data structure: Jungian shadow work philosophy excerpts with pre-computed embeddings
  - Seed data format: `{ id, text, embedding: number[], category }`
  - Methods: `initRagDatabase()`, `seedContent(content[])`, `verifySeed()`
  - **Validation**: Integration test — seed → query → verify embeddings exist
  - **Depends on**: T002 (expo-sqlite)

- [ ] **T022** — Integrate rag-content.db with existing ReflectionRAGRepository
  - Update `shared/ai/reflection-rag-repository.ts` to use the seeded SQLite database instead of OPSQLite vector store (or configure OPSQLite to use the seeded data)
  - Ensure `searchByText()` queries the seeded content
  - **Validation**: Integration test — search with reflection text → returns relevant Jungian content
  - **Depends on**: T021, existing ReflectionRAGRepository

- [ ] **T023** — Add rag-content.db initialization to app startup
  - Call `initRagDatabase()` and verify seed on app startup (lazy — only if not already seeded)
  - Handle missing/corrupted seed gracefully (re-seed or fallback)
  - **Validation**: App starts without errors; RAG queries return results
  - **Depends on**: T022

**Slice 4 checkpoint**: RAG retrieval works using seeded Jungian content. Guided question generation uses rag-content.db, not user reflections.

---

## Slice 5: Integration & Wiring

_Connects onboarding flow with existing features and ensures all routes work._

- [ ] **T024** — Update `app/index.tsx` to respect onboarding guard
  - Instead of directly rendering `DailyReflectionScreen`, check onboarding state
  - If onboarding incomplete → redirect to onboarding flow
  - If onboarding complete → render reflection screen
  - **Validation**: First launch shows onboarding; subsequent launches go to reflection
  - **Depends on**: T020

- [ ] **T025** — Update existing reflection feature to use rag-content.db RAG
  - Verify `features/reflection/service/reflection-service.ts` uses `ReflectionRAGRepository` with seeded content
  - Ensure RAG retrieval does NOT use user reflections (v1 constraint)
  - **Validation**: Integration test — create reflection → generate questions → questions reference Jungian concepts, not prior reflections
  - **Depends on**: T023

- [ ] **T026** — Add RAM cap to LocalAIRuntimeService
  - Update `shared/ai/local-ai-runtime.ts` to accept and respect `ramBudget60` parameter
  - Refuse to initialize if model estimated RAM > budget
  - **Validation**: Unit test — model exceeding budget → init fails with clear error
  - **Depends on**: T012

- [ ] **T027** — Create barrel exports for onboarding feature
  - File: `features/onboarding/index.ts`
  - Export all public APIs: models, repositories, services, view-models, screens
  - **Validation**: `bun run lint` passes, no unused exports
  - **Depends on**: T010, T017, T019

**Slice 5 checkpoint**: Full app flow works end-to-end. Onboarding gates access, reflection uses RAG correctly, all screens themed.

---

## Slice 6: Testing & Quality Gates

_Automated tests for all new functionality. Regression tests for existing features._

### Unit Tests

- [ ] **T028** — Unit tests: DeviceDetector
  - File: `tests/unit/onboarding/device-detector.spec.ts`
  - Test RAM detection, storage detection, biometric detection with mocked values
  - Test `ramBudget60` calculation accuracy
  - **Depends on**: T012

- [ ] **T029** — Unit tests: Model filtering
  - File: `tests/unit/onboarding/model-filtering.spec.ts`
  - Test compatibility filtering with various RAM budgets
  - Test recommendation logic
  - **Depends on**: T013

- [ ] **T030** — Unit tests: Security Gate state machine
  - File: `tests/unit/onboarding/security-gate-state.spec.ts`
  - Test password creation, validation, authentication flows
  - Test biometric enable/disable flows
  - Test error states and recovery
  - **Depends on**: T009

### Integration Tests

- [ ] **T031** — Integration test: Credential persistence
  - File: `tests/integration/onboarding/credential-persistence.spec.ts`
  - Test save → retrieve → verify password hash
  - Test first-launch flag transitions
  - **Depends on**: T008

- [ ] **T032** — Integration test: Model config persistence
  - File: `tests/integration/onboarding/model-config-persistence.spec.ts`
  - Test save → retrieve model configuration
  - Test download state transitions
  - **Depends on**: T014

- [ ] **T033** — Integration test: Review persistence (regression fix)
  - File: `tests/integration/review/review-persistence.spec.ts`
  - Test save → restart app → retrieve (verifies SQLite persistence)
  - **Depends on**: T003

- [ ] **T034** — Integration test: RAG with seeded content
  - File: `tests/integration/ai/rag-seeded-content.spec.ts`
  - Test that RAG retrieval returns Jungian content, not user reflections
  - Test search relevance with sample reflection text
  - **Depends on**: T025

### E2E Tests

- [ ] **T035** — E2E test: Onboarding flow (first-time user)
  - File: `tests/e2e/onboarding-flow.spec.ts`
  - Full flow: create password → enable biometric → select model → download → load model → enter app
  - **Depends on**: T020, T024

- [ ] **T036** — E2E test: Returning user flow
  - Same file as T035
  - Flow: authenticate (password or biometric) → model loads → enter app
  - **Depends on**: T020, T024

- [ ] **T037** — E2E test: Full user journey (regression)
  - File: `tests/e2e/full-journey.spec.ts`
  - Complete journey: onboarding → create reflection → generate questions → generate review → export markdown
  - **Depends on**: T025, existing features

### Regression Tests

- [ ] **T038** — Regression test: Privacy & language isolation
  - File: `tests/integration/regression/privacy-language.spec.ts`
  - Verify no reflection content is transmitted externally
  - Verify all generated output is in Brazilian Portuguese
  - Verify RAG does NOT use user reflections in v1
  - **Depends on**: T025

- [ ] **T039** — Update existing test for guided questions RAG source
  - Update `tests/integration/reflection/guided-questions-normal.spec.ts`
  - Assert that RAG context comes from seeded Jungian content, not prior reflections
  - **Depends on**: T025

---

## Task Dependency Graph

```
Slice 0 (Foundation):
  T001 ─┬─→ T005
        └─→ T006
  T002 → T003 → T004
  T011 → T012 ─┬─→ T013 → T014 ─┬─→ T018 → T019
               │                 ├─→ T016 → T017
               │                 └─→ T020 → T024
               ├─→ T015 ─┬─→ T016
               │         └─→ T018
               └─→ T026

Slice 1 (Security Gate):
  T007 → T008 → T009 → T010 ──→ T020

Slice 2 (Model Selection):
  T012 → T013 → T014 ─┬─→ T016 → T017 ──→ T020
                      └─→ T015 ─┬─→ T016
                                └─→ T018

Slice 3 (Model Loading):
  T014 + T015 → T018 → T019 ──→ T020

Slice 4 (RAG Seed):
  T002 → T021 → T022 → T023 ──→ T025
  T025 → T034, T038, T039

Slice 5 (Integration):
  T020 + T024 + T025 + T026 + T027

Slice 6 (Testing):
  T012 → T028
  T013 → T029
  T009 → T030
  T008 → T031
  T014 → T032
  T003 → T033
  T025 → T034, T038, T039
  T020 + T024 → T035, T036
  T025 + existing → T037
```

## Execution Order (Recommended)

1. **T001** → T002 → T003 → T004 → T005 → T006 (Slice 0: unblock everything)
2. **T007** → T008 → T011 → T012 (Slice 1 start: auth + device detection)
3. **T009** → T010 (Security Gate complete)
4. **T013** → T014 → T015 (Slice 2 start: model data + services)
5. **T016** → T017 (Model Selection complete)
6. **T018** → T019 (Model Loading complete)
7. **T020** → T024 (Routing guard + app entry)
8. **T021** → T022 → T023 → T025 (RAG seed + integrate)
9. **T026** → T027 (RAM cap + barrel exports)
10. **T028** → T039 (All tests)
