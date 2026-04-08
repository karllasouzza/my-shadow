# Quickstart: Private Shadow Reflection Journal

## Prerequisites

- **Bun** (package manager)
- **Android Studio** with Android SDK (for Android builds)
- **EAS CLI** (`npm i -g eas-cli`) — for building dev client
- Node.js 20+ (if Bun is not available for some commands)

## Setup

```bash
# Install dependencies
bun install

# Start Expo dev server
bun run dev

# Build Android dev client (first time or after native dependency changes)
bun run android
# Or with EAS:
eas build --profile development --platform android
```

## Development Workflow

```bash
# Start development server
bun run dev

# Run on connected Android device
bun run android

# Run linting
bun run lint

# Run tests
bun run test
bun run test:watch

# Clean and reinstall dependencies
rm -rf node_modules && bun run bun:ci
```

## Feature Architecture

This project follows a **MVVM + Repository + Service** pattern organized by feature modules:

```
features/<feature-name>/
├── model/           # Domain entities and validation
├── repository/      # Data access layer (MMKV, SQLite, etc.)
├── service/         # Business logic orchestration (AI, RAG, fallback)
├── view/            # React Native screens
├── view-model/      # ViewModel hooks (state + actions)
└── index.ts         # Barrel exports
```

### Existing Feature Status

| Feature    | CRUD | AI Generation                | Persistence             | UI              | Status                   |
| ---------- | ---- | ---------------------------- | ----------------------- | --------------- | ------------------------ |
| Reflection | ✅   | ✅ Local AI + RAG + Fallback | ✅ MMKV encrypted       | ✅ Full screen  | **Complete**             |
| Review     | ❌   | ✅ Service ready             | ⚠️ In-memory (MUST fix) | ✅ Screen ready | **Needs MMKV migration** |
| Export     | ✅   | N/A                          | N/A (on-demand)         | ✅ Screen ready | **Complete**             |
| Onboarding | ❌   | ❌                           | ❌                      | ❌              | **Needs to be built**    |

## Key Directories

| Path                 | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `app/`               | Expo Router routes (navigation layer only)                      |
| `features/`          | Feature modules (business logic + UI)                           |
| `shared/ai/`         | Local AI runtime, RAG repository, fallback prompts, tone guards |
| `shared/storage/`    | MMKV storage utilities and encrypted stores                     |
| `shared/security/`   | App lock (PIN + biometric)                                      |
| `shared/components/` | Reusable UI primitives (StateView)                              |
| `components/ui/`     | shadcn-style UI components (Button, Text)                       |
| `lib/`               | Utilities (MMKV wrapper, theme, color helpers)                  |
| `context/`           | React context providers (ThemeProvider)                         |

## Storage Instances

| Instance ID              | Encryption   | Purpose                                  |
| ------------------------ | ------------ | ---------------------------------------- |
| `reflection_encrypted`   | AES-256      | Reflections, questions, reviews          |
| `generation_jobs`        | No           | Retry queue for failed AI generation     |
| `app_lock`               | No           | Lock state, timeout tracking             |
| `powerlists-storage`     | Configurable | Legend State persist plugin              |
| `auth_credentials` (NEW) | AES-256      | User password hash, biometric flag       |
| `model_config` (NEW)     | No           | Model path, download status, last used   |
| `review_encrypted` (NEW) | AES-256      | Final reviews (migration from in-memory) |

## Local AI Stack

- **Runtime**: `react-native-executorch` (ExecuTorch LLM runtime)
- **Models**: Qwen 2.5 (0.5B, 1.5B, 3B with Q4/Q8 quantization)
- **RAG**: `react-native-rag` + `@react-native-rag/op-sqlite` (OPSQLite vector store)
- **Embeddings**: `multi-qa-minilm-l6` via ExecuTorch
- **rag-content.db**: Pre-built SQLite database with Jungian philosophy embeddings (bundled as asset)

## Important Constraints

- **Android only** for v1 (iOS deferred)
- **100% offline** — no external transmission of reflections or generated content
- **60% RAM budget** — model runtime must not exceed 60% of total device RAM
- **NativeWind className-only** — no inline styles with @rn-primitives components
- **Bun test runner** — tests import from `bun:test` (mapped to Jest)

## Common Tasks

### Add a new screen to a feature

1. Create screen in `features/<feature>/view/<screen>.tsx`
2. Create view-model in `features/<feature>/view-model/use-<screen>-vm.ts`
3. Wire route in `app/<route>.tsx` → import and render screen from feature
4. Export from `features/<feature>/index.ts`

### Add a new MMKV storage instance

```ts
import { createMMKV } from "react-native-mmkv";

export const myStorage = createMMKV({
  id: "my_storage_id",
  encryptionKey: "optional-32-char-key-for-aes-256",
});
```

### Test a feature

```bash
# Run all tests
bun run test

# Run specific test file
bunx jest tests/unit/reflection/create-reflection.spec.ts

# Watch mode
bun run test:watch
```

### Build for production

```bash
# Build Android APK/AAB
eas build --profile production --platform android

# Submit to Play Store
eas submit --platform android
```
