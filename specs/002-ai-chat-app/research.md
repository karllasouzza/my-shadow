# Research: AI Chat App Architecture

## Decision 1: shared/ai/ Ownership Boundary

**Decision**: `shared/ai/` owns all AI operations — inference (local-ai-runtime.ts), model lifecycle (model-manager.ts), and model catalog (model-catalog.ts). Features import from `@/shared/ai/` and never manage models or inference directly.

**Rationale**: Model lifecycle (download → verify → load → unload) is a cross-cutting concern. Any future AI feature would need these ops. Centralizing in shared/ai/ prevents duplication and ensures consistent behavior. Features only own their domain-specific storage (e.g., chat-service.ts for MMKV conversation CRUD).

**Alternatives considered**:

- Model manager in features/onboarding/ — rejected because onboarding is being removed, and model ops are not feature-specific
- Model manager split (download in shared/, load in runtime) — rejected for complexity, two imports needed per call

---

## Decision 2: Co-Located Components per Feature

**Decision**: Each feature module contains its own `components/` directory. Root `components/` is removed for feature-specific UI, keeping only cross-cutting primitives (`components/ui/`).

**Rationale**: Feature-sliced design. Each feature is self-contained — screen, VM, services, and UI components live together. No cross-feature component imports. Easy to extract, test, or reuse a feature independently. Root components/ was becoming a dumping ground with implicit dependencies.

**Alternatives considered**:

- Central components/ with shared imports — rejected: central dir becomes catch-all, hard to trace feature ownership
- Hybrid (dumb UI in root, smart in features) — rejected: "dumb vs smart" distinction is subjective and causes bikeshedding

---

## Decision 3: Model Management as Separate Feature

**Decision**: `features/model-management/` is its own feature with screen, VM, and components. Accessed via stack navigation from Chat header.

**Rationale**: Model lifecycle has 8+ UX states (no models, catalog browsing, downloading, verifying, loading, loaded, download failed, RAM warning). Embedding in Chat screen would violate SRP, bloat the screen, and make testing harder. Separate feature has clean test boundary and can evolve independently.

**Alternatives considered**:

- Modal overlay on Chat screen — rejected: modals can't host complex multi-state flows, harder to deep-link
- Inline panel above chat input — rejected: reduces chat area, awkward on small screens

---

## Decision 4: Legend State v3 Beta React Integration

**Decision**: Use periodic polling (`setInterval` + `.get()`) for React state sync instead of `useSnapshot` (which is not exported in v3.0.0-beta.46). Poll every 200ms — sufficient for chat UX where sub-200ms staleness is imperceptible.

**Rationale**: Legend State v3 beta removed `useSnapshot` export. The alternative API (`observe`) requires subscription management that adds boilerplate. Polling is simple, reliable, and performant for small observables (chat messages, model status). 200ms interval = 5Hz refresh, well above human perception threshold.

**Alternatives considered**:

- Manual subscribe/unsubscribe with `onChange` — rejected: adds lifecycle management per component
- Upgrade to stable Legend State — rejected: v3 beta is project's pinned version, upgrade out of scope

---

## Decision 5: Model File Path Convention

**Decision**: Downloaded GGUF models stored at `{documentDirectory}/models/{model-id}.gguf`. Path constructed as `file://${documentDirectory}models/${modelId}.gguf`. Model manager persists this path in MMKV after successful download.

**Rationale**: expo-file-system's `documentDirectory` is the only writable location that persists across app launches. `models/` subdirectory avoids cluttering document root. `file://` prefix required by llama.rn for model loading.

**Alternatives considered**:

- cacheDirectory — rejected: cleared by OS under memory pressure
- Custom native asset path — rejected: requires native code changes, out of scope
