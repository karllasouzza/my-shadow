# Quickstart: Private Shadow Reflection Journal

## Goal

Validate the planned feature behavior end-to-end before implementation breakdown.

## Prerequisites

- Bun installed.
- Mobile runtime configured for Expo SDK 54 project.
- Local AI model resources available for on-device inference.

## Setup

1. Install dependencies:
   - bun install
2. Start application:
   - bun run start
3. Lint baseline:
   - bun run lint

## Validation Scenarios

### Scenario 1: Daily Reflection + Guided Questions (P1)

1. Open the app and unlock with required app lock.
2. Create a new reflection entry in Portuguese BR.
3. Request guided questions with augmented generation enabled.
4. Expected result:
   - Reflection saved locally.
   - Guided questions returned in Portuguese BR.
   - Tone remains introspective and non-judgmental.

### Scenario 2: Temporary Local Generation Failure Fallback (P1)

1. Trigger local generation unavailability (test-mode simulation).
2. Request guided questions.
3. Expected result:
   - Immediate fallback template prompts are shown.
   - Retry job is queued for full local output.
   - User receives retry status feedback.

### Scenario 3: Period Final Review (P2)

1. Seed at least 5 reflections in a date range.
2. Request final review for that range.
3. Expected result:
   - Review in Portuguese BR.
   - Includes recurring patterns, triggers, and next inquiry prompts.
   - Completes within expected performance budget envelope.

### Scenario 4: Markdown Export (P3)

1. Choose date range with reflections.
2. Trigger explicit export action.
3. Expected result:
   - Markdown file generated with chronological entries.
   - Includes guided questions and final review sections when requested.
   - Empty-period export returns explicit no-content message.

### Scenario 5: Hard-Delete Cascade

1. Delete one reflection that has linked generated artifacts.
2. Expected result:
   - Reflection is removed immediately.
   - Linked question sets and review artifacts are removed in cascade.
   - No restore path is offered.

## Test Directory Targets

- Unit tests: /**tests**/unit
- Integration tests: /**tests**/integration
- End-to-end tests: /**tests**/e2e

## Documentation Targets

- Architecture notes: /**docs**/architecture
- Decision records: /**docs**/decisions
- Quality/performance evidence: /**docs**/quality
