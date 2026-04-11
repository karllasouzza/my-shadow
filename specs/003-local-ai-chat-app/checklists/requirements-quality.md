# Requirements Quality Checklist: Local AI Chat Application — Refatoração shared/ai/

**Purpose**: Validar a qualidade, clareza e completude dos requisitos da refatoração `shared/ai/` antes de iniciar implementação
**Created**: 10 de abril de 2026
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [tasks.md](../tasks.md)

<!--
  Este checklist é um "Unit Test for English" — valida a qualidade dos requisitos em si,
  NÃO verifica se a implementação funciona. Cada item avalia se os requisitos estão:
  - Completos (todos necessários presentes)
  - Claros (específicos e sem ambiguidade)
  - Consistentes (alinham entre si)
  - Mensuráveis (podem ser verificados objetivamente)
  - Cobertos (todos os cenários/addressados)
-->

## Requirement Completeness

- [ ] CHK001 — Are error handling requirements defined for all 8 AI-specific error codes? (`MODEL_NOT_FOUND`, `DOWNLOAD_FAILED`, `INSUFFICIENT_RAM`, etc.) [Completeness, Spec §FR-022]
- [ ] CHK002 — Are rollback/recovery requirements defined when model loading fails mid-operation? [Gap, Spec Edge Cases]
- [ ] CHK003 — Are memory cleanup requirements specified after `unloadModel()` to prevent leaks? [Gap, Plan Phase 9]
- [ ] CHK004 — Are requirements defined for concurrent download + load operations on the same model? [Coverage, Gap]
- [ ] CHK005 — Are legacy path migration requirements fully specified for all historical file naming patterns? [Completeness, Tasks T016-T017]
- [ ] CHK006 — Are requirements defined for what happens when `llama.rn` native module fails to initialize? [Gap, Spec FR-019]

## Requirement Clarity

- [ ] CHK007 — Is "últimas 10 mensagens (5 trocas)" quantified with exact token budget limits? [Clarity, Spec Clarifications, Data Model §Regras de Contexto]
- [ ] CHK008 — Is "truncar automaticamente" defined with precise algorithm (count from newest → oldest, drop oldest first)? [Clarity, Spec Clarifications, Data Model §Truncamento Automático]
- [ ] CHK009 — Is "RAM insuficiente" quantified with specific threshold (absolute value vs % of total)? [Clarity, Spec FR-013]
- [ ] CHK010 — Are "6 estados UX" explicitly enumerated with visual/behavioral definitions for each? [Clarity, Spec FR-019]
- [ ] CHK011 — Is "buffer de 100MB" for disk space validation justified with measurable criteria? [Clarity, Spec FR-012]
- [ ] CHK012 — Is the prompt format for inference explicitly defined (system/user/assistant tokens structure)? [Clarity, Data Model §Formato do Prompt]

## Requirement Consistency

- [ ] CHK013 — Do context window requirements align between Spec (§FR-001: 10 msgs), Clarifications (10 msgs), and Data Model (4096 tokens / 3584 effective)? [Consistency]
- [ ] CHK014 — Are download persistence requirements consistent between `setDownloadedModel()` calls and MMKV storage format? [Consistency, Plan Phase 4]
- [ ] CHK015 — Do error code definitions in `shared/ai/errors.ts` proposal align with existing `AppErrorCode` types in `shared/utils/app-error.ts`? [Consistency, Tasks T006]
- [ ] CHK016 — Are model status definitions consistent between Data Model (`ModelStatus`) and UI behavior in tasks? [Consistency, Data Model §6 vs Tasks T027]

## Acceptance Criteria Quality

- [ ] CHK017 — Can "55+ FPS durante geração" be objectively measured? What tool/method? [Measurability, Spec SC-003]
- [ ] CHK018 — Is "95% dos usuários conseguem fluxo completo" testable without a user study? [Measurability, Spec SC-005]
- [ ] CHK019 — Are success criteria for Phase 8 (ModelManager) defined independently of implementation? [Measurability, Tasks T027]
- [ ] CHK020 — Can "download persiste após restart do app" be verified with specific steps? [Measurability, Tasks T038]

## Scenario Coverage

### Primary Flows
- [ ] CHK021 — Are requirements complete for: download → validate → persist → display as "Disponível"? [Coverage, Spec US3 Scenarios 1-2]
- [ ] CHK022 — Are requirements complete for: select model → load → verify ready → chat? [Coverage, Spec US4 Scenarios 1-2]
- [ ] CHK023 — Are requirements complete for: send message → stream response → save conversation? [Coverage, Spec US1 Scenarios 1, 4]

### Alternate Flows
- [ ] CHK024 — Are requirements defined for: download interrupted → resumed → completed successfully? [Coverage, Spec Edge Case 1]
- [ ] CHK025 — Are requirements defined for: switching models mid-conversation? [Coverage, Gap]
- [ ] CHK026 — Are requirements defined for: conversation context exceeds token limit → truncation → continue generation? [Coverage, Spec Clarifications Q2]

### Exception/Error Flows
- [ ] CHK027 — Are requirements defined for: download fails → cleanup `.part` file → retry available? [Coverage, Tasks T019]
- [ ] CHK028 — Are requirements defined for: model file corrupted → detect → offer re-download? [Coverage, Spec Edge Case 4]
- [ ] CHK029 — Are requirements defined for: generation timeout (60s) → error message → user can retry? [Coverage, Spec FR-017, Data Model §GENERATION_TIMEOUT_MS]
- [ ] CHK030 — Are requirements defined for: insufficient RAM but user proceeds anyway → warning acknowledged? [Coverage, Spec FR-013]

### Recovery Flows
- [ ] CHK031 — Are rollback requirements defined when `loadModel()` fails after partial initialization? [Gap, Recovery, Tasks T032]
- [ ] CHK032 — Are recovery requirements defined for app crash during download? [Gap, Recovery, Spec Edge Case 3]
- [ ] CHK033 — Are state cleanup requirements defined after failed `unloadModel()`? [Gap, Recovery]

## Edge Case Coverage

- [ ] CHK034 — Are requirements defined for zero-state: no models downloaded, first app open? [Edge Case, Spec US1 Scenario 2]
- [ ] CHK035 — Are requirements defined for maximum edge: 50+ conversations saved, list performance? [Edge Case, Spec SC-008]
- [ ] CHK036 — Are requirements defined for model file at exact minimum boundary (5MB per `MIN_VALID_MODEL_BYTES`)? [Edge Case, Tasks T022]
- [ ] CHK037 — Are requirements defined for disk space at exact boundary (required + 100MB buffer)? [Edge Case, Tasks T023]
- [ ] CHK038 — Are requirements defined for empty message send attempt (validation edge case)? [Edge Case, Spec FR-018]

## Non-Functional Requirements

### Performance
- [ ] CHK039 — Are performance requirements quantified for model load time (< 5s for models up to 2GB)? [Clarity, Spec SC-004]
- [ ] CHK040 — Are first-token latency requirements measurable and realistic for 3B models? [Measurability, Spec SC-002]
- [ ] CHK041 — Are memory budget requirements defined for app baseline (< 150MB without model)? [Completeness, Plan Performance Goals]

### Error Handling
- [ ] CHK042 — Are user-facing error messages specified in Portuguese for all failure modes? [Consistency, Spec FR-022]
- [ ] CHK043 — Are error recovery paths specified for each of the 8 error codes? [Coverage, Tasks T006]

### Data Integrity
- [ ] CHK044 — Are conversation persistence durability requirements specified (MMKV write frequency, sync points)? [Completeness, Spec FR-003, FR-021]
- [ ] CHK045 — Are model config atomicity requirements defined (write all-or-nothing for downloaded map)? [Gap, Tasks T013]

## Dependencies & Assumptions

- [ ] CHK046 — Is the assumption "llama.rn v0.10.0 API is stable" validated against upstream docs? [Assumption, Plan Technical Context]
- [ ] CHK047 — Are external dependency requirements documented for `expo-file-system` resumable download API availability? [Dependency, Tasks T019]
- [ ] CHK048 — Is the assumption "DeviceInfo.getTotalMemory() returns accurate value" validated? [Assumption, Tasks T024]
- [ ] CHK049 — Are MMKV storage limits documented (1MB per instance) and validated against 50-conversation target? [Assumption, Data Model §MMKV Limits]
- [ ] CHK050 — Are HuggingFace download URL stability requirements documented (external dependency risk)? [Dependency, Spec Assumptions]

## Ambiguities & Conflicts

- [ ] CHK051 — Is the term "dispositivo com pouca RAM" quantified with specific MB/GB thresholds? [Ambiguity, Catalog data.ts descriptions]
- [ ] CHK052 — Is "modelos até 2GB" consistent with catalog entries (largest is 1.8GB)? [Consistency, Catalog data.ts vs Spec SC-004]
- [ ] CHK053 — Is the distinction between `modelId` (catalog ID) and filename (GGUF name) clearly defined throughout? [Ambiguity, Tasks T016, T035]
- [ ] CHK054 — Are "5 trocas usuário-IA" counted as message pairs or individual messages? [Ambiguity, Spec Clarifications Q1]
- [ ] CHK055 — Is "streaming token-a-token" defined with minimum update frequency (every token, batched, debounced)? [Ambiguity, Spec FR-001]

## Implementation Readiness

- [ ] CHK056 — Are task dependencies correctly mapped in the dependency graph (Phase 8 depends on 4,5,6,7)? [Accuracy, Tasks Dependency Graph]
- [ ] CHK057 — Are parallelizable tasks truly independent (different files, no shared state)? [Accuracy, Tasks marked [P]]
- [ ] CHK058 — Is the Strangler Fig approach feasible given the current import structure? [Feasibility, Plan Implementation Strategy]
- [ ] CHK059 — Are acceptance criteria testable for each of the 11 phases? [Measurability, Tasks Checkpoints]
- [ ] CHK060 — Is the "Phase 10: delete legacy" approach safe (all imports migrated first)? [Safety, Tasks T035-T036]

## Notes

- **Traceability**: 52/60 items (87%) include traceability references — exceeds 80% minimum ✅
- **Coverage Gaps Identified**: 
  - Rollback/recovery requirements incomplete (CHK002, CHK031, CHK032, CHK033)
  - Memory cleanup after unload (CHK003)
  - Concurrent operations handling (CHK004)
  - Streaming update frequency undefined (CHK055)
- **Ambiguities Requiring Clarification**:
  - CHK051: "pouca RAM" needs numeric threshold
  - CHK054: "5 trocas" counting method unclear
  - CHK055: streaming update batching undefined
- **Recommendation**: Resolve CHK051, CHK054, CHK055 before Phase 2 implementation begins
