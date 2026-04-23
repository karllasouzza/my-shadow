<!--
SYNC IMPACT REPORT
==================
Version change: N/A (initial constitution) -> 1.0.0
Added principles:
  - I. Privacy-First, Local-First
  - II. Test-Backed Code
  - III. Design Token Consistency
  - IV. Performance Budgets
  - V. Dependency Injection & Testability
Added sections:
  - Testing Standards
  - User Experience Consistency
  - Performance Requirements
Templates requiring updates:
  - .specify/templates/plan-template.md: Constitution Check section references new principles - OK as-is (generic placeholder)
  - .specify/templates/spec-template.md: No changes needed (technology-agnostic)
  - .specify/templates/tasks-template.md: No changes needed (generic task structure)
Follow-up TODOs: None
-->

# My Shadow Constitution

## Core Principles

### I. Privacy-First, Local-First

All user data remains on device. No cloud sync, no external API calls transmitting personal content, no telemetry. The app operates fully offline after initial model download. Any feature that requires sending user data to external services MUST be rejected or made strictly opt-in with explicit user consent and clear disclosure. Encrypted storage (Legend State + MMKV + expo-secure-store) is mandatory for all persisted data. Biometric authentication gates access to sensitive content.

**Rationale**: The product's core value proposition is privacy. Violating this principle undermines user trust and the product's raison d'etre.

### II. Test-Backed Code (NON-NEGOTIABLE)

Every module MUST have corresponding tests. Property-based testing with `fast-check` is required for pure functions, data transformations, and configuration generators. Component tests use `@testing-library/react-native`. Tests live in `tests/unit/` mirroring the `shared/` and `app/` source structure. New features without tests MUST NOT merge. The test suite runs on `bun test` and MUST pass before any commit.

**Rationale**: The AI runtime layer (model loading, inference, STT) involves complex device-adaptive logic that cannot be verified manually. Property tests catch edge cases in configuration generation, memory budgeting, and OOM fallback paths that example-based tests miss.

### III. Design Token Consistency

All UI styling uses NativeWind with design tokens defined in `global.css` and theme configuration in `lib/themes.ts`. Direct color hex values in component code are prohibited. Components use `@rn-primitives` building blocks with `cva` (class-variance-authority) for variant definitions. Accessibility requirements: minimum touch targets 44x44pt, color contrast WCAG AA, all interactive elements have `accessibilityLabel`.

**Rationale**: Consistent visual language across the app requires a single source of truth for colors, spacing, and typography. Token-first approach enables theme switching and reduces design drift.

### IV. Performance Budgets

The app MUST meet these performance targets on budget-tier devices (< 5 GB RAM):
- Cold start to interactive UI: under 3 seconds
- Inference throughput: max 1000ms to time to frist token and minimum 6 tok/s on qwen2.5-0.5b-q4
- Memory ceiling: never exceed 60% of available RAM
- OOM crash rate: under 5% on 4 GB devices
- List rendering: 60 fps with Legend List for entries > 100 items

Performance regressions MUST be caught in code review. Any change that increases memory footprint or degrades inference speed requires benchmark evidence and justification.

**Rationale**: The app runs local LLM inference on consumer mobile hardware. Without strict budgets, features will degrade the experience on mid-range and budget devices, which are the primary target.

### V. Dependency Injection & Testability

All services with external dependencies (native modules, file system, device sensors) MUST be injectable via constructor or context. Pure functions are preferred over classes where possible. The `shared/ai` and `shared/device` modules demonstrate the pattern: `DeviceDetector`, `RuntimeConfigGenerator`, `MemoryMonitor`, and `model-budget` are all independently constructible for testing. Mock implementations live alongside real ones in test fixtures.

**Rationale**: Native modules (llama.rn, whisper.rn, MMKV) cannot run in test environments. Without DI, testing business logic becomes impossible or requires expensive integration test infrastructure.

## Testing Standards

All tests MUST follow these conventions:

### Test Categories
- **Unit tests** (`tests/unit/`): Pure function verification, component rendering, state management logic
- **Property tests** (`*.property.test.ts`): Configuration generators, memory budgeting, data transformations, OOM detection invariants
- **Component tests** (`*.test.tsx`): UI component behavior, accessibility properties, user interaction flows
- **Integration tests** (`tests/integration/`): Cross-module interactions (e.g., model loader + runtime config generator)

### Naming Conventions
- Test files mirror source structure: `tests/unit/shared/ai/module-name.test.ts` for `shared/ai/module-name.ts`
- Property tests: `*.property.test.ts` suffix
- Accessibility tests: `*.accessibility.test.ts` suffix

### Coverage Expectations
- All pure functions: property tests covering boundary conditions
- All React components: component tests verifying render + key interactions
- All service modules: tests verifying correct behavior with mocked dependencies
- Error paths: every error type in `errors.ts` has at least one test exercising its creation and handling

### Test Quality Rules
- Tests MUST assert behavior, not implementation details
- Property tests MUST define meaningful invariants, not random data generation without purpose
- No `skip` or `todo` in committed tests
- Mock boundaries clearly: mock native modules at the DI layer, not internal module behavior

## User Experience Consistency

### Navigation
- Expo Router file-based routing: route structure in `app/` defines navigation hierarchy
- All navigational transitions use React Native's built-in animated transitions
- Bottom tab navigator for primary sections (chat, history, models)

### Feedback Patterns
- Loading states: skeleton placeholders or spinner with `accessibilityLabel`
- Error states: actionable error messages via `sonner-native` toasts with retry option where applicable
- Empty states: descriptive prompts explaining what the user can do next
- Destructive actions: confirmation dialog via `app-modal`

### Accessibility Baseline
- Screen reader support: all interactive elements have `accessibilityLabel` and `accessibilityRole`
- Dynamic type: text scales with system font size settings
- Reduced motion: respects `prefers-reduced-motion` for animations
- Voice input: all text input areas support voice-to-text via the STT pipeline

### Input Handling
- Keyboard-aware layouts via `react-native-keyboard-controller`
- Form validation with inline error messages
- Voice input indicator visible during recording

## Performance Requirements

### Device Adaptation
- Device detection runs at startup; profile determines model selection, context size, GPU offload strategy
- Runtime memory monitor triggers adaptive context reduction at > 85% utilization
- OOM fallback: halve context size and retry on memory pressure failure

### Model Management
- Model download progress must be visible to user
- Model integrity verification (SHA-256) after download
- Storage budget awareness: warn user when device storage is constrained

### List Performance
- All scrollable lists use `@legendapp/list` for virtualization
- FlatList is prohibited for datasets exceeding 50 items
- List items must have stable `key` props

### Bundle Size
- No unnecessary dependencies; each addition reviewed for size impact
- Code splitting via Expo Router lazy loading for non-critical routes
- Model files downloaded on-demand, not bundled

## Governance

This constitution supersedes all other development practices. Amendments require:
1. A documented rationale in the amendment commit
2. Version increment per semantic versioning (MAJOR for principle removals, MINOR for additions, PATCH for clarifications)
3. All PRs and reviews verify compliance with these principles
4. Complexity added to any feature must be justified against these principles

Code review checklist includes:
- Privacy: does this change transmit user data externally?
- Tests: are there corresponding tests for new/changed code?
- UX: does this follow design token and accessibility standards?
- Performance: does this affect startup time, memory usage, or inference speed?

**Version**: 1.0.0 | **Ratified**: 2026-04-23 | **Last Amended**: 2026-04-23
