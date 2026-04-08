# ADR-0001: Local-Only AI + Bun Test Runner + Feature-Based MVVM

**Status**: Adopted  
**Date**: 2026-04-07  
**Decision Makers**: Private Shadow Journal Team

## Context

The Private Shadow Reflection Journal aims to provide a Jungian shadow work experience that is:
1. **Privacy-first**: All data remains on device, no cloud sync in v1
2. **Autonomous**: Reflection and synthesis happen locally without external API calls
3. **Maintainable**: Code organized for independent feature development and testing
4. **Type-safe**: Full TypeScript coverage with strict mode
5. **Efficient**: Fast feedback loops in development and testing

## Decision

We adopt three architectural decisions:

### 1. Local-Only AI Inference (No Cloud APIs)

**Decision**: Use `llama.rn` for on-device model inference. No cloud LLM APIs (OpenAI, Anthropic, etc.).

**Rationale**:
- **Privacy**: Reflection content never leaves device
- **Offline**: Works without internet
- **Cost**: No per-token billing at scale
- **Control**: Full model behavior customization
- **Compliance**: No data residency concerns

**Trade-offs**:
- Model runs on user device (slower than cloud, model quality depends on device)
- Fallback to template prompts when inference unavailable
- Larger app bundle (+30-50MB for model)

**Mitigations**:
- Fallback Portuguese templates (fallback-prompts-ptbr.ts)
- Retry queue with exponential backoff for generation failures
- Local prompt tuning for Jungian perspective

### 2. Bun Native Test Runner (No Jest)

**Decision**: Use Bun's built-in test runner. Import tests from `"bun:test"` not `jest`.

**Rationale**:
- **Speed**: Bun is 20-50x faster than Node.js in startup/execution
- **Simplicity**: No configuration, built into Bun runtime
- **Consistency**: Same runtime for dev, test, and deployment
- **Dependencies**: No Jest, Babel, or ts-jest overhead

**Trade-offs**:
- Smaller ecosystem (less Stack Overflow content)
- TypeScript types require ambient declaration (types/bun-test.d.ts)
- Some Jest utilities not available (but replaceable)

**Implementation**:
- `types/bun-test.d.ts`: Ambient module providing describe, it, expect, beforeEach, etc.
- `tsconfig.json`: typeRoots pointing to ./types/
- `package.json`: `bun test` script runs all *.spec.ts files
- All test files: `import { describe, it, expect } from "bun:test"`

### 3. Feature-Based MVVM (Not Redux, Not Context API)

**Decision**: Organize features as Model → Repository → Service → ViewModel → View. Use React hooks (useState, useCallback) for state management, not Redux or Context API.

**Rationale**:
- **Modularity**: Each feature is independent and testable
- **Clarity**: Single responsibility per layer
- **Performance**: No global state tree (hooks avoid re-render overhead)
- **Simplicity**: useState/useCallback pattern familiar to React developers
- **Scalability**: Easy to add new features without touching core infrastructure

**Layers**:

| Layer | Responsibility | Example |
|-------|-----------------|---------|
| **Model** | Domain entity definition, validation, serialization | ReflectionEntry, FinalReview |
| **Repository** | CRUD operations, data access | ReflectionRepository.getById() |
| **Service** | Business logic, orchestration, error handling | ReflectionService.generateGuidedQuestions() |
| **ViewModel** | React hook managing screen state and actions | useDailyReflectionViewModel() |
| **View** | React Native component rendering UI | DailyReflectionScreen |

**Error Handling**:
- Models return `Result<T>` from `create()` with validation errors
- Repositories return `Result<T>` from all methods
- Services return `Result<T>` for orchestration errors
- ViewModels catch errors and store in state
- Views render error UI from state

**Trade-offs**:
- More boilerplate than simple useState components (mitigated by templates)
- No time-travel debugging like Redux DevTools
- Requires discipline to keep logic in correct layer

**Enforcement**:
- No service logic in components
- No repository calls from views (only via services)
- All async operations in services/viewmodels, not views
- Models validate on create(), not after construction

## Consequences

### Positive
✓ Reflection data never leaves device (maximum privacy)  
✓ Tests run 10-50x faster with Bun  
✓ Feature implementation is independent and parallel  
✓ Clear boundaries between layers  
✓ Easy to understand code organization for new team members  

### Negative
✗ Local model quality depends on device specs  
✗ App bundle larger (+50MB for model)  
✗ Bun ecosystem smaller than Node.js  
✗ Requires discipline to maintain MVVM boundaries  

### Mitigation
- Provide fallback Portuguese templates for generation failures
- Implement retry queue with exponential backoff
- Document MVVM checklist in architecture guide
- Enforce layer boundaries in code review

## Related Decisions

- **NativeWind v5 (className only)**: Paired with MVVM to keep styling composable
- **Portuguese pt-BR requirement**: At model validation layer (not view layer)
- **Jungian content principles**: At service layer (AI prompts), not separate layer
- **Encrypted MMKV storage**: Hidden behind repository abstraction

## Implementation Checkpoints

- [ ] All Phase 1-2 infrastructure complete (Setup + Foundational)
- [ ] Phase 3 (Daily Reflection) complete with all tests passing
- [ ] Phase 4 (Period Review) complete with all tests passing
- [ ] Phase 5 (Markdown Export) complete with all tests passing
- [ ] Phase 6 (Polish) complete: regression tests, performance validation, security gates
- [ ] Release readiness: lint clean, 90%+ test coverage, all manual tests passed

## References

- Architecture document: [private-shadow-journal.md](./private-shadow-journal.md)
- Model examples: features/reflection/model/, features/review/model/, features/export/model/
- Service examples: features/reflection/service/, features/review/service/, features/export/service/
- ViewModel examples: features/reflection/view-model/, features/review/view-model/, features/export/view-model/
- Test imports: `import { describe, it, expect } from "bun:test"` in all *.spec.ts files
