# Implementation Plan: Private Shadow Reflection Journal

**Branch**: `001-private-shadow-journal` | **Date**: 2026-04-07 | **Spec**: /specs/001-private-shadow-journal/spec.md
**Input**: Feature specification from `/specs/001-private-shadow-journal/spec.md`

## Summary

Build a private, secure, single-user reflection app that runs local AI workflows (RAG + llama.rn)
to generate Jungian shadow-work guided questions and period reviews in Brazilian Portuguese, with
markdown export and strict local-only privacy guarantees.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19, Expo SDK 54, React Native 0.81  
**Primary Dependencies**: Expo Router, react-native-rag, @react-native-rag/executorch, react-native-executorch (llama.rn runtime path), @react-native-rag/op-sqlite, nativewind, @rn-primitives UI building blocks  
**Storage**: Encrypted local persistence for reflection records + local vector store (OP SQLite) + local settings/state store  
**Testing**: Jest + React Native Testing Library + integration tests + device-level e2e flows, all under /**tests**  
**Target Platform**: iOS and Android (offline-first mobile app)  
**Project Type**: mobile-app (feature-based MVVM architecture)  
**Performance Goals**: Guided questions <= 8s p95, period review <= 20s p95, markdown export <= 10s p95 on target devices  
**Constraints**: Local-only generation, no cloud sync, mandatory app lock, encrypted local storage, hard-delete cascade, Brazilian Portuguese-only generated output  
**Scale/Scope**: Single user, up to 365 entries/year, period review up to 30 entries/request in v1

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Phase 0 Gate Assessment

- **Code Quality Gate**: PASS
  - Plan enforces strict TypeScript, lint/typecheck in CI, MVVM boundaries, and reusable shared
    components before introducing new abstractions.
- **Testing Gate**: PASS
  - Unit, integration, and e2e coverage is defined per story with regression coverage for privacy,
    language, and export risks in /**tests**.
- **UX Consistency Gate**: PASS
  - Shared component primitives + NativeWind tokens, explicit loading/empty/success/error states,
    and BR-PT consistency are included in scope.
- **Performance Gate**: PASS
  - p95 budgets are explicit in spec and included in verification strategy via repeatable
    instrumentation and scenario-based profiling.

### Post-Phase 1 Gate Re-Assessment

- **Code Quality Gate**: PASS (design artifacts define feature boundaries, contracts, and entity
  rules aligned with MVVM separation).
- **Testing Gate**: PASS (quickstart scenarios and contracts map directly to required test suites).
- **UX Consistency Gate**: PASS (state contracts and view-model outputs cover all required states).
- **Performance Gate**: PASS (data model and generation contracts keep scope bounded to planned
  request sizes and retry behavior).

## Project Structure

### Documentation (this feature)

```text
specs/001-private-shadow-journal/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── reflection-service-contract.md
│   └── markdown-export-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── _layout.tsx
├── index.tsx
└── (reflection)/
    ├── daily.tsx
    ├── review.tsx
    └── export.tsx

features/
├── reflection/
│   ├── model/
│   ├── view-model/
│   ├── view/
│   ├── repository/
│   └── service/
├── review/
│   ├── model/
│   ├── view-model/
│   ├── view/
│   └── service/
└── export/
    ├── model/
    ├── view-model/
    ├── view/
    └── service/

shared/
├── ai/
├── components/
├── storage/
├── theme/
└── utils/

__tests__/
├── unit/
├── integration/
└── e2e/

__docs__/
├── architecture/
├── decisions/
└── quality/
```

**Structure Decision**: Feature-based folder structure with MVVM was selected to isolate each
user story domain (reflection, review, export), keep reusable UI and infra in shared modules,
and make tests/docs placement explicit in /**tests** and /**docs**.

## Complexity Tracking

No constitution violations requiring justification.
