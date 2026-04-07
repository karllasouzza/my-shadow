<!--
Sync Impact Report
Version change: 0.0.0 (template) -> 1.0.0
Modified principles:
- Initial ratification (all principles defined from template placeholders)
Added sections:
- Core Principles with four enforceable principles
- Engineering Standards
- Delivery Workflow & Quality Gates
Removed sections:
- Placeholder Principle V section from template
Templates requiring updates:
- .specify/templates/plan-template.md ✅ updated
- .specify/templates/spec-template.md ✅ updated
- .specify/templates/tasks-template.md ✅ updated
- .specify/templates/commands/*.md ⚠ pending (directory not present in repository)
Follow-up TODOs:
- None
-->

# My Shadow Constitution

## Core Principles

### I. Code Quality Is A Release Requirement

All production code changes MUST pass linting, type checks, and peer review before merge.
Code MUST favor small composable units, clear naming, and reuse of existing shared utilities
or components before introducing new abstractions. New abstractions MUST include a short
justification in the plan or PR notes when complexity increases.
Rationale: Consistent internal quality reduces regression risk and keeps feature velocity high.

### II. Testing Standards Are Non-Negotiable

Every behavior change MUST include automated tests at the appropriate level (unit,
integration, or end-to-end) and those tests MUST fail before implementation and pass before
merge. Bug fixes MUST include a regression test. Changes without executable validation MUST
not be merged unless explicitly approved with documented risk acceptance.
Rationale: Reliable tests are the primary control against shipping regressions.

### III. User Experience Must Remain Consistent

User-facing changes MUST follow established interaction patterns, theme tokens, and component
primitives already used in the app. Every flow MUST define loading, empty, success, and error
states, and MUST satisfy baseline accessibility expectations for labels, contrast, and input
feedback. Deviations require explicit product and engineering approval.
Rationale: UX consistency builds trust and lowers cognitive load for users.

### IV. Performance Budgets Must Be Explicit

Each feature MUST declare measurable performance expectations before implementation and MUST
verify results after implementation. For mobile interactions, changed flows SHOULD target
responsive interactions and avoid avoidable re-renders, blocking work on the main thread, or
unbounded memory growth. Regressions beyond agreed thresholds MUST be fixed or formally waived.
Rationale: Performance is part of product quality, not a post-release activity.

## Engineering Standards

- Language and tooling baseline MUST remain TypeScript + Expo Router + React Native with lint
  and formatting checks enabled in local development and CI.
- Shared theming and UI primitives MUST be used for new screens and components unless a
  documented exception is approved.
- New dependencies MUST be justified by clear value, maintenance posture, and bundle/runtime
  impact.
- All externally visible behavior changes MUST include documentation updates in the relevant
  feature spec, quickstart, or README section.

## Delivery Workflow & Quality Gates

- Planning MUST include a constitution check for code quality, testing scope, UX consistency,
  and performance budgets.
- Implementation MUST proceed in independently testable slices aligned to user stories.
- Reviews MUST verify tests, UX states, and performance evidence before approval.
- Releases MUST block on unresolved critical defects, failing tests, or unapproved performance
  regressions.

## Governance

- This constitution overrides conflicting local conventions in planning and delivery artifacts.
- Amendments require: (1) proposed text change, (2) rationale, (3) impacted template updates,
  and (4) approval from maintainers responsible for the affected areas.
- Versioning policy: MAJOR for incompatible governance changes or principle removal/redefinition;
  MINOR for new principles/sections or materially expanded obligations; PATCH for clarifications
  that do not change required behavior.
- Compliance review is mandatory for every plan and PR, and reviewers MUST explicitly confirm
  constitution adherence or document approved exceptions.
- Runtime development guidance lives in README.md and feature docs under specs/.

**Version**: 1.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-04-07
