# Private Shadow Reflection Journal - Architecture

## Overview

The Private Shadow Reflection Journal is a local-first, privacy-preserving reflection and analysis application built with React Native, Expo, and local AI inference. All data remains on device with encrypted storage. No cloud sync or external API calls in v1.

## Feature-Based MVVM Architecture

The application is organized as feature modules, each implementing the Model-View-ViewModel (MVVM) pattern:

### Layer Structure

```
features/
├── reflection/
│   ├── model/              # Domain entities (ReflectionEntry, GuidedQuestionSet)
│   ├── repository/         # Data access layer (CRUD, queries)
│   ├── service/            # Business logic (generation, validation, cascade delete)
│   ├── view-model/         # React hooks managing screen state (useDailyReflectionViewModel)
│   ├── view/               # UI components (daily-reflection-screen.tsx)
│   └── index.ts            # Public API exports
├── review/
│   ├── model/              # FinalReview domain model
│   ├── repository/         # Review queries and persistence
│   ├── service/            # Review generation and synthesis
│   ├── view-model/         # usePeriodReviewViewModel
│   ├── view/               # period-review-screen.tsx, retry-status-banner.tsx
│   └── index.ts
└── export/
    ├── model/              # ExportBundle domain model
    ├── repository/         # Export persistence
    ├── service/            # Markdown generation
    ├── view-model/         # useExportViewModel
    ├── view/               # export-screen.tsx
    └── index.ts
```

### Model Layer

Domain models represent core business concepts with validation and serialization:

- **ReflectionEntry**: Daily reflection with creation date, content, tone, guidance mode
- **GuidedQuestionSet**: Generated follow-up questions in pt-BR with meta data
- **FinalReview**: Period-based synthesis with patterns, triggers, prompts
- **ExportBundle**: Markdown export with metadata (file size, section count)

All models implement:
- **Static `create()`**: Full validation, returns `Result<T>`
- **`toRecord()`**: Serialize to persistence format
- **`fromRecord()`**: Deserialize from storage
- **Validation rules**: ISO dates, pt-BR content, non-empty fields, sequential dates

### Repository Layer

CRUD access layer with consistent `Result<T>` error handling:

- **getById(id)**: Fetch single entity
- **getByPeriod(start, end)**: Range queries
- **save(entity)**: Create or update
- **delete(id)**: Remove entity
- **listAll()**: Retrieve all
- **clear()**: Wipe all (testing only)

Repository singleton pattern via `getXxxRepository()` function.

### Service Layer

Business logic and orchestration:

- **Validation**: Upstream to models, services assume inputs are valid
- **Coordination**: Multiple repositories, external services (AI, storage)
- **Error propagation**: All methods return `Result<T>` from `shared/utils/app-error`
- **Portuguese**: All generated content in pt-BR
- **Jungian perspective**: Introspection-focused prompts and synthesized content

Example: `ReflectionService.generateGuidedQuestions()` → validate input → call AI → save result → return metadata.

### ViewModel Layer

React hooks managing screen state and user actions:

```typescript
function useDailyReflectionViewModel(service?: ReflectionService) {
  const [state, setState] = useState<State>({...})
  const action = useCallback(async (...args) => {...}, [deps])
  return { state, action, ... }
}
```

State typically includes:
- `isLoading`: Async operation in progress
- `error`: Latest error message
- `data`: Primary domain object
- `metadata`: Secondary info (file size, section counts, etc.)

Actions:
- Always async with proper error handling
- Update state before, during, after operation
- Clear errors when user dismisses
- Reset state for "New" or "Clear" workflows

### View Layer

React Native screens using NativeWind v5 (className only, no style prop):

- Accept ViewModel via hook call: `const { state, action } = useXxxViewModel()`
- Display StateView wrapper for async states (loading, error, ready)
- Render controlled inputs with ViewModel callbacks
- Use component library from `@rn-primitives` + NativeWind for consistent styling
- All text in pt-BR or user-controlled language

## Shared Infrastructure

### Storage (`shared/storage/`)

- **encrypted-reflection-store.ts**: MMKV-backed encryption layer, handles all persistence
- **generation-job-store.ts**: Tracks queued and retried generation jobs
- **reflection-cascade-delete.ts**: Coordinator for hard-delete with cascade to all linked artifacts

### AI Runtime (`shared/ai/`)

- **local-ai-runtime.ts**: Bootstrap llama.rn with model loading
- **reflection-rag-repository.ts**: Vector embeddings wrapper for semantic search
- **fallback-prompts-ptbr.ts**: Fallback templates when local generation unavailable
- **retry-queue-worker.ts**: Async queue for failed generation retries
- **ptbr-tone-guard.ts**: Validator ensuring generated content is pt-BR and Jungian-aligned

### Security (`shared/security/`)

- **app-lock.ts**: Biometric + PIN gate before app access
- **use-app-lock.ts**: React hook for app lock state and unlock flow

### Utils (`shared/utils/`)

- **app-error.ts**: Standardized error handling with `Result<T>` type
- **performance-metrics.ts**: Timing utilities for generation profiling

## Data Flow Example: Daily Reflection

1. **User Action**: User opens daily reflection screen
2. **ViewModel Init**: `useDailyReflectionViewModel()` initializes with empty state
3. **View Render**: `DailyReflectionScreen` renders with input fields
4. **Content Input**: User types reflection, ViewModel state updates via `setContent()`
5. **Generate Questions**: User taps "Generate Questions"
6. **Service Call**: ViewModel calls `reflectionService.generateGuidedQuestions()`
7. **Model Creation**: Service creates `ReflectionEntry` via `ReflectionEntry.create()`
8. **Validation**: Model validates pt-BR content, date, tone
9. **AI Inference**: Service calls `localAiRuntime.generateQuestions()` with fallback to templates
10. **Persistence**: Service saves via `reflectionRepository.save()`
11. **State Update**: ViewModel updates `{ reflection, isLoading: false }`
12. **UI Render**: Screen displays reflection + generated questions

## Error Handling Strategy

### Result<T> Type

```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: AppError }
```

### AppError Structure

```typescript
interface AppError {
  code: AppErrorCode
  message: string
  context?: Record<string, unknown>
}
```

### Propagation Rules

- Models throw validation errors via `Result<T>` in `create()`
- Repositories return `Result<T>` from all methods
- Services return `Result<T>` from orchestration
- ViewModels catch errors and store in state for UI display
- Views render error banners with user-friendly messages

## Testing Strategy

### Unit Tests (`tests/unit/`)

- Model validation and serialization
- Repository CRUD operations
- Service business logic in isolation

### Integration Tests (`tests/integration/`)

- Service + Repository coordination
- Multiple services working together
- Realistic mock data

### E2E Tests (`tests/e2e/`)

- Complete user journeys
- State machine flows
- Feature completion criteria

### Test Patterns

- All tests import from `"bun:test"` (describe, it, expect, beforeEach)
- Mock external services (AI, storage) with in-memory replacements
- Use realistic pt-BR fixtures
- Verify Jungian content principles

## Dependencies

- **React Native 0.81**: Core UI framework
- **Expo SDK 54**: Cross-platform runtime
- **Expo Router**: Client-side routing
- **NativeWind v5**: Tailwind CSS for React Native (className only)
- **@rn-primitives**: UI components building blocks
- **react-native-mmkv**: Key-value storage
- **llama.rn**: Local LLM inference
- **Bun**: Native test runner and build tool

## Performance Characteristics

- Local generation: 1-10s depending on model size and device
- Fallback templates: <100ms
- Encryption/decryption: <50ms per entry
- Search/query: <200ms across 1000+ entries

## Security & Privacy

- **Zero cloud**: All operations local only
- **Encrypted storage**: MMKV with AES-256 (via react-native-mmkv)
- **Biometric lock**: App-level authentication
- **No logs**: Sensitive data never logged
- **No telemetry**: No external calls or tracking
- **Open source**: Auditable codebase

## Future Expansion Points

- **Cloud sync** (v2): iCloud, Google Drive, signal server
- **Web client** (v2): Expo DOM for web access
- **Shared journaling** (v3): Encrypted collaboration with consent
- **Advanced analytics** (v3): On-device pattern recognition
- **Model customization** (v3): User-fine-tuned reflection prompts
