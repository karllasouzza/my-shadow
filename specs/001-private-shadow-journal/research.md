# Research: Private Shadow Reflection Journal

## Decision 1: Local AI stack for private generation

- Decision: Use react-native-rag with @react-native-rag/executorch (llama.rn via react-native-executorch) and @react-native-rag/op-sqlite for retrieval and local generation.
- Rationale: This stack is already present in the workspace and supports on-device inference plus vector retrieval without external APIs.
- Alternatives considered: Cloud LLM APIs (rejected due to privacy constraints), custom native inference bridge (rejected due to implementation complexity), no-RAG generation (rejected due to weaker contextual continuity).

## Decision 2: Feature-based MVVM architecture

- Decision: Organize code by feature domains (reflection, review, export) using MVVM layers (view, view-model, model, service/repository).
- Rationale: This improves modularity, testability, and story-by-story delivery while keeping UI and business logic separated.
- Alternatives considered: Layer-first folders across the whole app (rejected due to weaker feature isolation), Redux-centric architecture (rejected because current flow is service/use-case oriented and does not require global state complexity).

## Decision 3: Bun as package/runtime tooling

- Decision: Use Bun commands for install, run, and test workflows.
- Rationale: User requested Bun and it offers fast script execution while remaining compatible with existing package scripts.
- Alternatives considered: npm or yarn only (rejected to honor explicit project constraint).

## Decision 4: Reusable native UI with NativeWind

- Decision: Keep reusable components and shared primitives, styling with NativeWind.
- Rationale: Matches existing dependency set and supports consistent UI states required by constitution (loading/empty/success/error).
- Alternatives considered: Pure StyleSheet-only approach (rejected for slower scaling across feature modules), custom design system from scratch (rejected for v1 scope).

## Decision 5: Security posture for sensitive reflections

- Decision: Enforce encrypted local storage, mandatory app lock, no cloud sync, and hard-delete cascade for linked artifacts.
- Rationale: Reflection data is highly sensitive and needs strict local-only controls aligned with clarified requirements.
- Alternatives considered: Optional security modes (rejected due to trust and ambiguity risk), soft-delete retention (rejected by clarification decision).

## Decision 6: Degraded-mode generation behavior

- Decision: If local generation is temporarily unavailable, return fallback template prompts immediately and queue local retry for full output.
- Rationale: Preserves user flow continuity while still delivering full AI output once local runtime recovers.
- Alternatives considered: Blocking until retry succeeds (rejected for poor UX), failure-only behavior (rejected for reduced product value during outages).

## Decision 7: Testing and documentation layout

- Decision: Place tests under /**tests** (unit, integration, e2e) and documentation under /**docs**.
- Rationale: Explicit, discoverable structure requested by user and compatible with phased implementation.
- Alternatives considered: tests/ and docs/ defaults (rejected because user requested explicit custom roots).

## Decision 8: Contract style for application boundaries

- Decision: Define service contracts as markdown interface specs for view-model to domain service interactions and export flows.
- Rationale: Fits a mobile app with internal boundaries and supports test planning without over-committing to transport-layer APIs.
- Alternatives considered: OpenAPI/HTTP endpoint contracts (rejected because feature is local-first and not backend-API centered in v1).
