# Research: Onboarding Flow & Local AI Infrastructure

## 1. Biometric Authentication on Android

**Decision**: Use `expo-local-authentication` with biometric strong level and optional PIN fallback.

**Rationale**: Already available in the Expo ecosystem, no native module needed. Supports fingerprint and facial recognition on Android via BiometricPrompt API (Class 2/3).

**Implementation pattern**:

- Check `hasHardwareAsync()` and `isEnrolledAsync()` on security gate
- For first-time users: prompt to create app password (stored in MMKV encrypted instance), optionally enroll biometric
- For returning users: `authenticateAsync()` with `biometricsSecurityLevel: 'strong'`
- `disableDeviceFallback: false` allows PIN/pattern as fallback

**Alternatives considered**: Custom native module with Android BiometricPrompt directly — rejected because expo-local-authentication covers all needed functionality and is already in the dependency tree.

## 2. Password Storage Strategy

**Decision**: App password stored as salted hash in encrypted MMKV instance (`reflection_encrypted` or dedicated `app_lock` instance). Biometric enrollment flag stored as boolean in same instance.

**Rationale**: MMKV encryption (AES-256 via C++ JSI bindings) provides sufficient security for password hashes. expo-secure-store has ~2KB size limit and is better suited for small tokens (PIN hash), but MMKV is already used for the app_lock instance and is synchronous — ideal for first-launch checks.

**Implementation pattern**:

```ts
// Encrypted MMKV instance
const authStorage = createMMKV({
  id: "auth_credentials",
  encryptionKey: "...",
});

// Store salted password hash
authStorage.set("password_hash", hashedPassword);
authStorage.set("biometric_enabled", true);
authStorage.set("first_launch", false);
```

**Alternatives considered**: expo-secure-store — rejected because it's async (would complicate routing guards) and has size limitations. MMKV encrypted is sync and already the project pattern.

## 3. Model Download & Storage Location

**Decision**: Default to `Paths.document` for model storage. Offer Android Storage Access Framework (SAF) as optional advanced choice for users who want explicit folder control.

**Rationale**: DocumentDirectory persists across restarts and isn't purged by the OS. SAF provides native Android folder picker but adds complexity (file must exist before writing via `createFileAsync`).

**Implementation pattern**:

- Default path: `Paths.document.uri + 'models/'`
- Optional: `StorageAccessFramework.requestDirectoryPermissionsAsync()` for custom folder
- Track selected path in ModelConfiguration stored in MMKV
- Download via `File.downloadFileAsync` (expo-file-system v54 API) with progress monitoring

**Alternatives considered**: CacheDirectory — rejected because OS can purge it. External storage — rejected because it's unreliable and requires additional permissions.

## 4. Device RAM Detection & Model Filtering

**Decision**: Use `react-native-device-info` for total RAM detection. Use `Paths.availableDiskSpace` from expo-file-system for storage check.

**Rationale**: No Expo-native package provides RAM detection. react-native-device-info is the standard, well-maintained solution. Requires EAS build (not Expo Go compatible) — acceptable since project uses dev client.

**Model filtering logic**:

```
totalRAM * 0.6 = budget60
For each available model:
  if estimatedRAM < budget60 → include as compatible
  if estimatedRAM > budget60 → exclude
Sort by quality (larger model = better output within budget)
```

**Model RAM estimates at runtime**:
| Model | Quantization | File Size | Runtime RAM |
|-------|-------------|-----------|-------------|
| Qwen 0.5B | Q4_K_M | ~350MB | ~500MB |
| Qwen 0.5B | Q8_0 | ~580MB | ~800MB |
| Qwen 1.5B | Q4_K_M | ~1GB | ~1.5GB |
| Qwen 1.5B | Q8_0 | ~1.6GB | ~2.2GB |
| Qwen 3B | Q4_K_M | ~1.8GB | ~2.5GB |
| Qwen 3B | Q8_0 | ~3.2GB | ~4.0GB |

**Recommendation by device tier**:

- ≤4GB RAM devices: Qwen 0.5B Q4 only
- 6GB RAM: Qwen 1.5B Q4 (comfortable), 3B Q4 possible
- ≥8GB RAM: Qwen 3B Q4/Q8 comfortable

**Alternatives considered**: Reading `/proc/meminfo` via native module — rejected as too complex for marginal benefit over react-native-device-info.

## 5. Back Button Prevention During Loading

**Decision**: Use `usePreventRemove` from React Navigation for blocking back during model loading. Combine with `BackHandler` for confirmation dialog on cancel.

**Rationale**: `usePreventRemove` is the React Navigation recommended approach and works with Expo Router. Conditional on `isLoading` state — automatically removed when loading completes or user cancels.

**Alternatives considered**: Custom overlay blocking navigation stack — rejected as more complex and fragile compared to built-in prevention.

## 6. Onboarding State Persistence

**Decision**: MMKV with versioned onboarding flag. Three keys: `onboarding.completed`, `onboarding.version`, `model.downloaded`.

**Rationale**: MMKV is synchronous, already used throughout the project, and ideal for routing guards. Version flag allows detecting when onboarding flow changes and re-running setup.

**Routing guard pattern**:

```ts
// In _layout.tsx or root guard
const completed = appStorage.getBoolean('onboarding.completed') ?? false;
const hasModel = appStorage.getBoolean('model.downloaded') ?? false;

if (!completed) → navigate to Security Gate
if (!hasModel) → navigate to Model Selection
else → navigate to Model Loading
```

## 7. rag-content.db Bundling

**Decision**: Bundle as Expo asset, copy to document directory on first run if not present. Register `.db` extension in Metro resolver.

**Rationale**: Simplest distribution method. File is copied once and then accessed locally by OPSQLite vector store. No network dependency.

**Implementation pattern**:

```ts
import { Asset } from "expo-asset";
const asset = Asset.fromModule(require("@/assets/rag-content.db"));
await asset.downloadAsync();
// Copy asset.localUri to documentDirectory + 'rag-content.db'
```

**Size considerations**: If rag-content.db exceeds ~50MB, app bundle size increases significantly. For larger databases, consider downloading on first launch instead. For v1, bundling is acceptable if the embedding database is reasonably sized.

**Alternatives considered**: Download on first launch — rejected because it adds network dependency to an offline-first product. Empty schema + seed via API — rejected because it changes the product from offline-capable to online-setup-required.

## 8. ReviewRepository Migration (Map → MMKV)

**Decision**: Replace in-memory Map with encrypted MMKV instance (`review_encrypted`), following the same pattern as `EncryptedReflectionStore`.

**Rationale**: Current in-memory Map loses all reviews on app restart, making period review unusable and violating SC-003 (100% offline flow completion). This is a critical bug fix, not a feature addition.

**Implementation pattern**: Mirror `EncryptedReflectionStore` pattern — serialize `FinalReview` to JSON, store with period key, deserialize on read. Add migration function that preserves any in-memory reviews currently held if app hasn't restarted yet.

## 9. ThemeProvider Mounting

**Decision**: Wrap the root Stack in `_layout.tsx` with `ThemeProvider` from the context module.

**Rationale**: ThemeProvider is already built but not mounted. Without it, theme-dependent components and NativeWind `vars()` may not resolve correctly. This is a one-line fix that enables proper theming across all screens.

**Implementation**:

```tsx
// app/_layout.tsx
import { ThemeProvider } from "@/context/themes";

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <ThemeProvider>
          {" "}
          {/* ADD THIS */}
          <Stack>...</Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

## 10. Existing Code Leverage Analysis

**Already built and reusable**:

- `features/reflection/` — complete (CRUD, IA generation, RAG, fallback, retry, cascade delete)
- `features/review/` — service, view-model, view implemented; **only repository needs MMKV migration**
- `features/export/` — complete
- `shared/ai/` — LocalAIRuntimeService, ReflectionRAGRepository, FallbackPromptProvider, PtBRJungianGuard, RetryQueueWorker — all implemented
- `shared/security/app-lock.ts` — AppLockGateway implemented with PIN; **needs extension for first-time password creation flow**
- `shared/storage/` — EncryptedReflectionStore, GenerationJobStore — patterns to reuse
- `components/ui/` — Button (6 variants), Text (typography variants) — to be used in onboarding screens
- `shared/components/state-view.tsx` — loading/empty/error/success states — to be reused in model loading screen

**Needs to be built from scratch**:

- `features/onboarding/` — entire module (3 screens + services + repositories)
- rag-content.db asset bundling
- ThemeProvider mounting in \_layout.tsx
- Route wiring for review.tsx and export.tsx
