<!--
Sync Impact Report:
- Version change: 1.1.0 → 1.2.0
- List of modified principles: none renamed; new principles added.
- Added sections: Simplicity & Micro-components; English Commits, Comments & Docs (language rules).
- Removed sections: None.
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: None.
-->

# Project Constitution: Private Shadow Journal

**Version**: 1.2.0  
**Ratification Date**: 2026-04-07  
**Last Amended Date**: 2026-04-15

## Introduction

This document defines the non-negotiable principles and governance policies for the
Private Shadow Journal. All development, planning, and specifications must align with
these rules to ensure privacy, performance, and psychological safety.

## Guiding Principles

### 1. Feature-Based MVVM Integrity

**Rules**:

- All code MUST follow the Model-Repository-Service-ViewModel-View pattern.
- ViewModels MUST NOT contain business logic or direct repository calls; they must
  delegate to Services.
- TypeScript MUST be used in strict mode with zero `any` types allowed.
- Components MUST use NativeWind `className` for styling; direct `style` props are prohibited.

**Rationale**: Ensures a modular, testable, and maintainable codebase where the UI
remains decoupled from the complex local AI orchestration.

### 2. Test-Driven Reliability (Bun Native)

**Rules**:

- Every feature MUST include Unit, Integration, and E2E tests using the Bun test runner.
- Logic within Services and Models MUST maintain at least 80% line coverage.
- Tests MUST import from `"bun:test"` and avoid legacy frameworks like Jest.
- All critical user flows (Daily Reflection, Period Review) MUST have passing E2E tests
  before merge.

**Rationale**: As a privacy-first app without cloud observability, local testing is our
only guarantee that the application functions correctly for the user.

### 3. Introspective UX & pt-BR Consistency

**Rules**:

- All user-facing text, including AI-generated content, MUST be in Brazilian Portuguese (pt-BR).
- AI prompts MUST maintain a Jungian shadow work perspective: exploratory, introspective,
  and non-prescriptive.
- UI components MUST utilize `@rn-primitives` to ensure accessibility and consistent
  interaction patterns.
- Dates MUST follow the `DD/MM/YYYY` format for display and `ISO 8601` for storage.

**Rationale**: Consistency in language and tone is vital for the user's psychological
comfort and the "Shadow Journal" brand identity.

### 4. Local-First Performance Budgets

**Rules**:

- App cold start time MUST be under 2 seconds on standard hardware (e.g., iPhone 13).
- Local AI generation (llama.rn) MUST NOT exceed 15 seconds (p95) for a standard
  reflection set.
- Memory footprint during inference MUST stay within device-specific limits (e.g., < 2GB
  for a 4GB RAM device).
- All AI generation MUST provide a fallback template mechanism for low-resource states.

**Rationale**: Running LLMs locally is resource-intensive; strict performance gating
prevents the app from becoming unresponsive or crashing.

### 5. Absolute Privacy & Local Autonomy

**Rules**:

- No user data, metadata, or telemetry MUST ever leave the device.
- External API calls are strictly forbidden in application logic (excluding model downloads).
- All data at rest MUST be encrypted using AES-256 via MMKV.
- The app MUST remain fully functional without internet connectivity.

**Rationale**: Privacy is the core value proposition. Zero-trust regarding external
networks is the only way to guarantee user safety.

### 6. Simplicity & Micro-components

**Rules**:

- Code structure MUST favor small, single-responsibility components and micro-logics. If a
  component performs more than one distinct responsibility, it MUST be refactored into
  smaller components.
- Business logic MUST live in Services, hooks, or small utility modules; UI components MUST
  contain only presentation and orchestration code.
- New UI components MUST be composable and testable in isolation; prefer composition over
  conditional complexity inside a single component.

**Rationale**: Small, focused components reduce cognitive load, improve testability, and
make incremental changes safer and faster.

### 7. English Commits, Comments & Docs (with pt-BR UI Text)

**Rules**:

- All commit messages, pull request descriptions, inline code comments, and documentation
  files MUST be written in English.
- All user-facing text (labels, button text, helper text, prompts) MUST be in Brazilian
  Portuguese (pt-BR). Localization artifacts and verification steps MUST be included in
  feature deliverables.
- PRs MUST include a short verification checklist that confirms language and localization
  requirements are met.

**Rationale**: English-language commits and docs maximize team collaboration and discoverability
for contributors while keeping the product experience consistently localized for end users.

## Governance

### Amendment Procedure

1. **Proposal**: Any material change to principles requires a version bump.
2. **Review**: Changes must be reviewed against existing ADRs (Architectural Decision Records).
3. **Sync**: Upon amendment, the `speckit.constitution` command must be run to propagate
   changes to all templates.

### Versioning Policy

- **MAJOR**: Removal or redefinition of core privacy or architectural principles.
- **MINOR**: Addition of new principles or material expansion of existing guidance.
- **PATCH**: Typo fixes, wording clarifications, and non-semantic refinements.

### Compliance Review

- Every PR must be validated against the "Specification Quality Checklist."
- `/speckit.analyze` must be run to ensure alignment between `spec.md`, `plan.md`,
  and `tasks.md`.

---

**Note**: This constitution is a living document. Last updated by Gemini Code Assist.
