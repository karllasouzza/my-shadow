# Feature Specification: Private Shadow Reflection Journal

**Feature Branch**: `001-private-shadow-journal`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Build a private and secure personal application that helps me reflect on my daily actions using local AI with RAG and llama.rn to generate questions and a final review. It should have the option to export notes in markdown. All reflections and tone are based on Carl Jung shadow philosophy, and all generated content is focused on Brazilian Portuguese."

## Clarifications

### Session 2026-04-07

- Q: What baseline privacy posture should v1 enforce for sensitive reflections? -> A: Mandatory encrypted local storage, mandatory app lock, and no cloud sync in v1.
- Q: How should the app behave when local generation temporarily fails? -> A: Show offline template prompts immediately and queue local retry for full AI output.
- Q: How should deletion behave for reflections and linked generated artifacts? -> A: Hard-delete immediately in cascade with no recovery.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Daily Reflection with Guided Questions (Priority: P1)

As a person reflecting on daily actions, I want to write private reflections and receive follow-up
questions that deepen self-observation through a Jungian shadow-work perspective.

**Why this priority**: This is the core product value and the minimum useful outcome for daily
practice.

**Independent Test**: Can be fully tested by creating a reflection entry and requesting guided
questions; value is delivered when private notes and context-aware questions are available.

**Acceptance Scenarios**:

1. **Given** the user creates a new daily reflection, **When** the entry is saved, **Then** the
   entry is stored privately and at least one guided follow-up question is produced in Brazilian
   Portuguese.
2. **Given** the user has prior reflections, **When** new guided questions are generated,
   **Then** the questions reference relevant prior context and maintain a non-judgmental,
   introspective tone.

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
- End-to-end tests MUST cover complete user journeys: create reflection, generate questions,
  generate final review, and export markdown.
- For each story, tests MUST fail before implementation and pass after implementation.
- Regression tests MUST be added for language leakage, privacy boundary failures, and malformed
  markdown export outputs.

### Edge Cases

- User submits an extremely short reflection with minimal context.
- User includes mixed-language text in input while generated output must remain Brazilian
  Portuguese.
- Reflection generation is requested while local generation capability is temporarily unavailable,
  requiring immediate fallback prompts and deferred full-output retry.
- User has no prior reflections and still requests guided questions.
- User requests final review over a very large date range.
- User interrupts generation or export mid-process.
- User deletes a reflection that has linked guided questions, queued retries, and final review data.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to create, edit, and delete dated reflection entries.
- **FR-002**: System MUST store reflections and generated outputs only in encrypted local storage
  on the user device.
- **FR-003**: System MUST generate guided follow-up questions based on the current reflection and
  relevant past reflections.
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
- **FR-013**: System MUST require app unlock (biometric, PIN, or device passcode) before
  displaying reflection content.
- **FR-014**: System MUST NOT provide cloud sync in v1 and MUST NOT transmit reflection or
  generated content to remote services during core reflection flows.
- **FR-015**: If local generation is temporarily unavailable, system MUST immediately provide
  offline template prompts in Brazilian Portuguese so reflection flow can continue.
- **FR-016**: When fallback prompts are used, system MUST queue a local retry for full generated
  output and notify the user when the retry result is available.
- **FR-017**: Deleting a reflection MUST immediately hard-delete the reflection and all linked
  generated artifacts in cascade with no recovery option.

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
- Local generation capability is available on supported user devices after initial setup.
- The app is a reflection aid and not a medical or therapeutic diagnostic tool.
