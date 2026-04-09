# Feature Specification: Private Shadow Reflection Journal

**Feature Branch**: `001-private-shadow-journal`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Build a private and secure personal application that helps me reflect on my daily actions using local AI with RAG and llama.rn to generate questions and a final review. It should have the option to export notes in markdown. All reflections and tone are based on Carl Jung shadow philosophy, and all generated content is focused on Brazilian Portuguese."
**Target Platform v1**: Android only. iOS support deferred to v2.

## Clarifications

### Session 2026-04-07

- Q: What baseline privacy posture should v1 enforce for sensitive reflections? -> A: Mandatory encrypted local storage, mandatory app lock, and no cloud sync in v1.
- Q: How should the app behave when local generation temporarily fails? -> A: Show offline template prompts immediately and queue local retry for full AI output.
- Q: How should deletion behave for reflections and linked generated artifacts? -> A: Hard-delete immediately in cascade with no recovery.
- Q: Should styling use React Native style prop or NativeWind className approach? -> A: Mandatory NativeWind className-only approach throughout. No inline style prop usage with @rn-primitives components. All styling uses Tailwind CSS classes via NativeWind v5.
- Q: Which test runner should be used? -> A: Bun native test runner (import from "bun:test"). Not Jest. Bun provides better performance, zero additional dependencies, and native TypeScript support.
- Q: Where should the local AI model be stored and how should model loading behave on app launch? -> A: Tela inicial permite ao usuário escolher e baixar o modelo para uma pasta de sua escolha. Se já houver 1+ modelos baixados, o carregamento inicia automaticamente na abertura. A tela inicial gerencia download, seleção e carregamento do modelo.
- Q: How should RAG retrieval work — what content is embedded and indexed? -> A: RAG usa um rag-content.db pré-construído contendo embeddings de conteúdo filosófico Junguiano (shadow work). Não há embeddings das reflexões do usuário em v1. Dados do usuário para retrieval ficam deferidos para v3 (envolvem tratamento de dados e segurança adicionais).
- Q: How is the rag-content.db sourced and distributed? -> A: Empacotado no app bundle (shipped with app), com opção de atualização sob demanda.
- Q: What are the minimum device hardware requirements for running local LLM? -> A: Tela inicial detecta RAM e storage do dispositivo, recomenda LLMs compatíveis e bloqueia modelos incompatíveis ou que excedam a RAM disponível. O uso máximo de RAM é limitado a 60% da RAM total do dispositivo.
- Q: Which target platforms should v1 support? -> A: Android primeiro (v1), iOS em v2.

## User Scenarios & Testing _(mandatory)_

### Explicit Out of Scope for v1

- iOS support (deferred to v2)
- Cloud sync or cross-device data sharing
- RAG retrieval from user's own reflections (deferred to v3)
- Multi-user or shared journal features
- Medical or therapeutic diagnostic features

---

### User Story 0 - Secure Onboarding & Model Loading Flow (Priority: P0)

As a user opening the app, I must pass through a mandatory 3-screen flow before I can access any
reflection content: (1) security unlock / first-time password setup, (2) model selection &
download, (3) model loading. This ensures all content is protected and the AI engine is ready
before use.

**Why this priority**: This is the gate through which every user passes. No reflection, question
generation, review, or export is accessible without completing this flow first.

**Independent Test**: Can be fully tested by launching the app as a first-time user and as a
returning user, verifying each screen's behavior, transitions, and error handling.

**Screen Flow**:

1. **Screen 1 — Security Gate**:
   - **First-time user**: App prompts creation of a password. Optionally offers biometric
     (fingerprint) enrollment linked to the device's biometric API.
   - **Returning user**: App requires password entry or biometric unlock to proceed.
   - No app content is visible until authentication succeeds.

2. **Screen 2 — Model Selection & Download**:
   - **First-time user (no model downloaded)**: Displays available compatible LLM models filtered
     by device RAM/storage. User selects a model, chooses a download folder, and initiates
     download with progress feedback.
   - **Returning user (≥1 model already downloaded)**: This screen is **skipped automatically**;
     the app proceeds directly to Screen 3.

3. **Screen 3 — Model Loading**:
   - Loads the selected (or most-recently-used) model into memory.
   - This screen is **mandatory** — the user cannot enter the app until the model is successfully
     loaded.
   - Displays loading progress, and error states with retry/cancel options.
   - On success, transitions to the main reflection interface.

**Acceptance Scenarios**:

1. **Given** a first-time user opens the app, **When** the security gate appears, **Then** the
   user must create a password and optionally enable biometric unlock before proceeding.
2. **Given** a returning user opens the app, **When** the security gate appears, **Then** the
   user must authenticate via password or biometric to proceed.
3. **Given** a first-time user passes security, **When** the model selection screen appears,
   **Then** the user can browse, select, and download a compatible LLM to a folder of their choice.
4. **Given** a returning user with ≥1 model downloaded passes security, **When** authentication
   succeeds, **Then** the app skips Screen 2 and proceeds directly to model loading (Screen 3).
5. **Given** the model loading screen is active, **When** loading completes successfully,
   **Then** the user is transitioned to the main reflection interface.
6. **Given** model loading fails, **When** the user is on Screen 3, **Then** a clear error
   message is shown with retry and cancel options, and the user cannot access reflection content
   until loading succeeds.

---

### User Story 1 - Daily Reflection with Guided Questions (Priority: P1)

As a person reflecting on daily actions, I want to write private reflections and receive follow-up
questions that deepen self-observation through a Jungian shadow-work perspective.

**Why this priority**: This is the core product value and the minimum useful outcome for daily
practice.

**Independent Test**: Can be fully tested by creating a reflection entry and requesting guided
questions; value is delivered when private notes and context-aware questions are available.

**Acceptance Scenarios**:

1. **Given** the user has completed the onboarding flow (User Story 0), **When** the user creates
   a new daily reflection and saves it, **Then** the entry is stored privately and at least one
   guided follow-up question is produced in Brazilian Portuguese.
2. **Given** the user has prior reflections, **When** new guided questions are generated,
   **Then** the questions are contextually relevant to the current reflection and maintain a
   non-judgmental, introspective tone aligned with Jungian shadow-work principles.

---

### User Story 2 - Period Review and Shadow Pattern Synthesis (Priority: P2)

As a person doing ongoing self-reflection, I want a period-based final review so I can understand
behavior patterns, emotional triggers, and recurring shadow themes.

**Why this priority**: A synthesized review turns isolated notes into actionable insight and
supports longer-term reflection.

**Independent Test**: Can be independently tested by loading multiple reflections for a selected
period and generating a final review that summarizes recurring themes and next reflection prompts.

**Acceptance Scenarios**:

1. **Given** the user has multiple reflections in a selected date range, **When** the user
   requests a final review, **Then** the system provides a structured summary in Brazilian
   Portuguese with recurring patterns and suggested next inquiry points.
2. **Given** the selected period has too little material for deep synthesis, **When** review
   generation runs, **Then** the system informs the limitation and still returns a concise,
   useful review.

---

### User Story 3 - Markdown Export of Reflection History (Priority: P3)

As a person who journals privately, I want to export reflections and generated insights to markdown
so I can archive, review, and use them outside the app.

**Why this priority**: Export increases ownership of personal data and supports long-term journal
workflows.

**Independent Test**: Can be independently tested by selecting a date range and generating a
markdown file containing reflections, guided questions, and final reviews.

**Acceptance Scenarios**:

1. **Given** reflections and generated content exist, **When** the user exports notes,
   **Then** the exported markdown includes timestamps, original reflections, guided questions,
   and final review sections in readable structure.
2. **Given** the user selects an empty period, **When** export is requested, **Then** the system
   returns a clear no-content message and does not produce an empty misleading export.

### Testing Strategy _(mandatory)_

- Unit tests MUST cover reflection entry validation, language enforcement rules, tone constraints,
  and markdown formatting logic.
- Integration tests MUST cover reflection persistence, contextual retrieval, guided question
  generation, period review generation, and export pipeline.
- End-to-end tests MUST cover complete user journeys: security gate → model setup → model
  loading → create reflection → generate questions → generate final review → export markdown.
- For each story, tests MUST fail before implementation and pass after implementation.
- Regression tests MUST be added for language leakage, privacy boundary failures, and malformed
  markdown export outputs.

### Edge Cases

- User kills the app mid-onboarding and reopens — system must resume from the correct screen
  without losing partial state (e.g., incomplete download, partial password setup).
- User presses back button during model loading — system must block navigation and keep user on
  the loading screen until success or explicit cancel.
- User has a previously downloaded model but the file was deleted externally — system must detect
  missing file and redirect to model selection screen.
- User opens the app with no downloaded model and must complete initial model setup before reflection.
- Device has insufficient RAM or storage for any compatible model; system must inform the user
  and block model selection.
- Selected model exceeds 60% RAM budget at runtime; system must refuse to load and suggest a
  smaller alternative.
- Model download fails or is interrupted; user must be able to retry or cancel gracefully.
- Model file becomes corrupted after download; system must detect and prompt re-download.
- rag-content.db is missing or corrupted; system must provide fallback prompts and alert user
  that contextual generation is limited until database is restored.
- User submits an extremely short reflection with minimal context.
- User includes mixed-language text in input while generated output must remain Brazilian
  Portuguese.
- Reflection generation is requested while local generation capability is temporarily unavailable,
  requiring immediate fallback prompts and deferred full-output retry.
- User has no prior reflections and still requests guided questions (RAG retrieval uses only
  rag-content.db Jungian content, so prior reflections are not required for generation).
- User requests final review over a very large date range.
- User interrupts generation or export mid-process.
- User deletes a reflection that has linked guided questions, queued retries, and final review data.

## Requirements _(mandatory)_

### Functional Requirements

#### Onboarding & Security Screens

- **FR-000a**: System MUST present a security gate as the first screen on app launch. For
  first-time users, the system MUST prompt for password creation and offer optional biometric
  (fingerprint) enrollment. For returning users, the system MUST require password or biometric
  authentication before any content is visible.
- **FR-000b**: After successful authentication, system MUST navigate to model selection & download
  screen IF no model is downloaded, or skip directly to model loading screen IF ≥1 model exists.
- **FR-000c**: Model loading screen MUST load the selected or most-recently-used model into memory
  and MUST block access to the main reflection interface until loading completes successfully.
- **FR-000d**: If model loading fails, system MUST display an error message with retry and cancel
  options. User MUST NOT be able to access reflection content while the model is not loaded.

- **FR-001**: System MUST allow users to create, edit, and delete dated reflection entries.
- **FR-002**: System MUST store reflections and generated outputs only in encrypted local storage
  on the user device.
- **FR-003**: System MUST generate guided follow-up questions based on the current reflection and
  relevant content retrieved from a pre-built rag-content.db containing embeddings of Jungian
  shadow-work philosophy. The system MUST NOT embed or index user reflections for RAG retrieval in v1.
- **FR-004**: System MUST generate all guided questions and final reviews in Brazilian Portuguese.
- **FR-005**: System MUST align generated tone with Jungian shadow reflection principles:
  introspective, non-moralizing, and self-awareness oriented.
- **FR-006**: System MUST provide a final review for a selected period that highlights recurring
  behavior patterns, emotional triggers, and potential shadow themes.
- **FR-007**: System MUST allow users to regenerate guided questions and final reviews without
  overwriting previous reflection entries.
- **FR-008**: System MUST allow users to export selected reflections and generated content to a
  markdown document.
- **FR-009**: System MUST preserve chronological order and clear section labeling in markdown
  exports.
- **FR-010**: System MUST operate core reflection flows without requiring external service
  connectivity during normal use.
- **FR-011**: System MUST provide explicit user feedback for loading, success, and failure states
  during generation and export actions.
- **FR-012**: System MUST prevent unintended data sharing by requiring explicit user action before
  export.
- **FR-013**: System MUST require app unlock (Android biometric or device PIN/pattern) before
  displaying reflection content.
- **FR-014**: System MUST NOT provide cloud sync in v1 and MUST NOT transmit reflection or
  generated content to remote services during core reflection flows.
- **FR-015**: If local generation is temporarily unavailable, system MUST immediately provide
  offline template prompts in Brazilian Portuguese so reflection flow can continue.
- **FR-016**: When fallback prompts are used, system MUST queue a local retry for full generated
  output and notify the user when the retry result is available.
- **FR-017**: Deleting a reflection MUST immediately hard-delete the reflection and all linked
  generated artifacts in cascade with no recovery option.
- **FR-018**: System MUST provide an initial screen where users can select, download, and manage
  local AI models to a user-chosen folder. If at least one model is already downloaded, the
  system MUST automatically begin loading the most recently used model on app launch.
- **FR-019**: System MUST display loading, progress, and error states during model download and
  loading on the initial screen, and MUST allow the user to cancel or retry failed downloads.
- **FR-020**: System MUST provide a mechanism to check for and download updates to the bundled
  rag-content.db, replacing the local copy only after successful verification of the new version.
- **FR-021**: System MUST detect device RAM and available storage on the initial screen, filter
  and recommend compatible LLM models, and block models that exceed 60% of total device RAM.
- **FR-022**: System MUST cap LLM runtime memory usage at 60% of total device RAM and MUST
  gracefully degrade or refuse generation if no compatible model fits within this budget.

### Code Quality Requirements _(mandatory)_

- **CQ-001**: All feature changes MUST pass linting, static type checks, and automated test
  suites before merge.
- **CQ-002**: Reflection rules, language constraints, and export formatting behavior MUST be
  covered by automated tests.
- **CQ-003**: Changes to generation behavior MUST include documented rationale and updated examples
  in feature artifacts.

### UX Consistency Requirements _(mandatory for user-facing changes)_

- **UX-001**: All user-visible UI text and generated reflective content MUST be presented in
  Brazilian Portuguese.
- **UX-002**: Reflection capture, question generation, final review, and export flows MUST each
  define loading, empty, success, and error states.
- **UX-003**: Generated messages MUST avoid clinical diagnosis language and maintain supportive,
  reflective wording.
- **UX-004**: Users MUST receive clear confirmation before destructive actions and before export.

### Performance Requirements _(mandatory)_

- **PF-001**: Guided question generation for a reflection up to 500 words MUST complete within
  8 seconds at p95 on the target device class.
- **PF-002**: Final review generation for up to 30 entries MUST complete within 20 seconds at p95.
- **PF-003**: Markdown export for up to 365 entries MUST complete within 10 seconds at p95.
- **PF-004**: If a performance budget is exceeded, the system MUST provide progress feedback and
  allow cancel-and-retry behavior.

### Key Entities _(include if feature involves data)_

- **UserCredential**: Authentication data for the first-time user including password hash (salted),
  biometric enrollment flag, and first-launch flag. Used by the security gate to determine
  authentication mode.
- **ModelConfiguration**: A user-selected local AI model with metadata including file path, model
  name, size, download status, last-used timestamp, and estimated RAM usage. Only one model can
  be active at a time.
- **DeviceInfo**: Detected device hardware metrics including total RAM, available storage, and
  computed compatible model list. Used to filter and recommend models on the initial screen.
- **RagContentDB**: A pre-built local database containing embeddings of Jungian shadow-work
  philosophy content. Shipped bundled with the app and optionally updatable on demand. Used for
  RAG retrieval during guided question generation. Not generated from user data in v1.
- **ReflectionEntry**: A dated personal reflection containing raw text, optional mood/context
  tags, and update metadata.
- **GuidedQuestionSet**: A generated set of follow-up reflective questions tied to a specific
  reflection and context window.
- **FinalReview**: A period-based synthesized reflection including recurring patterns, trigger
  themes, and next inquiry prompts.
- **ExportBundle**: A user-requested markdown export artifact containing selected entries,
  generated questions, final review content, and export metadata.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 90% of users complete one daily reflection and receive guided questions in
  under 5 minutes from opening the app.
- **SC-002**: In acceptance evaluations, 95% of generated outputs are fully usable in Brazilian
  Portuguese without manual rewriting.
- **SC-003**: In offline acceptance scenarios, 100% of core flows (write reflection, generate
  questions, generate review, export markdown) complete successfully after initial setup.
- **SC-004**: At least 85% of pilot users rate the review tone as introspective and
  non-judgmental (score 4 or 5 on a 5-point scale).
- **SC-005**: Markdown export succeeds in at least 99% of valid export attempts.
- **SC-006**: Release readiness maintains zero unresolved critical quality gates for linting,
  typing, and required tests.
- **SC-007**: p95 generation and export timings meet all declared performance budgets.
- **SC-008**: 100% of reflection-content access attempts require successful app unlock before
  content is visible.
- **SC-009**: 0 core-flow events transmit reflection or generated content to external services in
  v1.
- **SC-010**: In simulated local-generation outages, 100% of attempts still return immediate
  fallback prompts and at least 95% complete queued local retry within 2 minutes.
- **SC-011**: 100% of deletion actions remove targeted reflections and linked generated artifacts
  from user-accessible storage immediately, with no recoverable remnants in app flows.

## Assumptions

- The product is single-user and personal in scope for the first release.
- Users intentionally provide reflective free-text input regularly (at least several entries per
  week) to improve review quality.
- Local generation capability is available on supported Android devices after initial setup.
- The app is a reflection aid and not a medical or therapeutic diagnostic tool.
- v1 targets Android devices with sufficient RAM and storage to run a local LLM within 60% RAM budget.
