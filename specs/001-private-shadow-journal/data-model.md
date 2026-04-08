# Data Model: Private Shadow Reflection Journal

## Entities

### UserCredential

Authentication state for app access. Created on first launch, verified on every subsequent launch.

```typescript
interface UserCredential {
  /** Salted SHA-256 hash of user's app password */
  passwordHash: string;
  /** Salt used in password hashing (stored separately from hash) */
  passwordSalt: string;
  /** Whether user enrolled in biometric authentication */
  biometricEnabled: boolean;
  /** Whether this is the first app launch (onboarding not completed) */
  isFirstLaunch: boolean;
  /** Timestamp of credential creation */
  createdAt: string;
  /** Timestamp of last successful authentication */
  lastAuthenticatedAt: string | null;
}
```

**Validation rules**:

- `passwordHash` must be non-empty, minimum 64 chars (SHA-256 hex)
- `passwordSalt` must be non-empty, minimum 32 chars (random hex)
- `isFirstLaunch` defaults to `true` on app install, set to `false` after password creation

**Storage**: Encrypted MMKV instance (`auth_credentials`) with AES-256 encryption. Keys: `password_hash`, `password_salt`, `biometric_enabled`, `first_launch`, `created_at`, `last_authenticated_at`.

**State transitions**:

```
[Not Created] → (create password) → [Created, isFirstLaunch=true]
[Created, isFirstLaunch=true] → (password confirmed) → [Created, isFirstLaunch=false]
[Created, isFirstLaunch=false] → (authenticate) → [Authenticated]
[Authenticated] → (app backgrounded >15min) → [Locked]
[Locked] → (authenticate) → [Authenticated]
```

---

### ModelConfiguration

User's selected AI model with download and loading metadata.

```typescript
interface ModelConfiguration {
  /** Unique identifier for this model configuration */
  id: string;
  /** Model name as displayed to user (e.g., "Qwen 2.5 0.5B Q4") */
  displayName: string;
  /** Internal model key (e.g., "qwen2.5-0.5b-q4") */
  modelKey: string;
  /** Local file path to the downloaded model file (.gguf) */
  filePath: string;
  /** Model file size in bytes */
  fileSizeBytes: number;
  /** Estimated RAM usage at runtime in bytes */
  estimatedRamBytes: number;
  /** Download status */
  downloadStatus:
    | "pending"
    | "downloading"
    | "completed"
    | "failed"
    | "cancelled";
  /** Download progress (0.0 to 1.0) */
  downloadProgress: number;
  /** Whether this model has been successfully loaded into memory */
  isLoaded: boolean;
  /** Timestamp of last successful model load (used for "most recently used" selection) */
  lastUsedAt: string | null;
  /** User-selected folder URI (empty = default Paths.document) */
  customFolderUri: string | null;
}
```

**Validation rules**:

- `filePath` must be a valid file URI pointing to an existing `.gguf` file
- `estimatedRamBytes` must not exceed 60% of device total RAM
- `downloadStatus` must transition through valid states: `pending → downloading → completed` or `pending → downloading → failed/cancelled`
- `downloadProgress` must be between 0.0 and 1.0

**Storage**: MMKV instance (`model_config`) with JSON serialization. Key: `active_model`.

**State transitions**:

```
[Not Downloaded] → (select + download) → [Downloading (progress: 0→1)]
[Downloading] → (complete) → [Downloaded]
[Downloading] → (fail) → [Failed]
[Downloading] → (cancel) → [Cancelled]
[Failed/Cancelled] → (retry) → [Downloading]
[Downloaded] → (load into memory) → [Loaded]
[Loaded] → (unload/app restart) → [Downloaded, isLoaded=false]
```

---

### AvailableModel

Catalog entry for a downloadable LLM model. Used to populate the model selection screen.

```typescript
interface AvailableModel {
  /** Unique model identifier */
  key: string;
  /** Human-readable name */
  name: string;
  /** Model description (capabilities, trade-offs) */
  description: string;
  /** Download URL */
  downloadUrl: string;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Estimated runtime RAM in bytes */
  estimatedRamBytes: number;
  /** Quantization type (Q4_K_M, Q8_0, etc.) */
  quantization: string;
  /** Whether this model is recommended for the current device */
  isRecommended: boolean;
  /** Whether this model is compatible with the current device */
  isCompatible: boolean;
  /** Reason for incompatibility (if applicable) */
  incompatibilityReason: string | null;
}
```

**Validation rules**:

- `estimatedRamBytes` must be known at build time for each catalog entry
- `isCompatible` = `estimatedRamBytes <= deviceTotalRAM * 0.6`
- `isRecommended` = best quality model within 60% RAM budget

---

### DeviceInfo

Snapshot of device hardware capabilities. Computed once on model selection screen mount.

```typescript
interface DeviceInfo {
  /** Total device RAM in bytes */
  totalRamBytes: number;
  /** Available disk space in bytes */
  availableStorageBytes: number;
  /** 60% RAM budget in bytes */
  ramBudget60: number;
  /** Whether device has biometric hardware */
  hasBiometricHardware: boolean;
  /** Whether biometrics are enrolled */
  isBiometricEnrolled: boolean;
  /** Platform (always 'android' for v1) */
  platform: "android";
}
```

**Derived fields**:

- `ramBudget60 = totalRamBytes * 0.6`
- Compatible model list = `AvailableModel[].filter(m => m.estimatedRamBytes <= ramBudget60)`

---

### ReflectionEntry

_(Existing — documented for completeness)_

```typescript
interface ReflectionEntry {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}
```

**Storage**: Encrypted MMKV (`reflection_encrypted`).

---

### GuidedQuestionSet

_(Existing — documented for completeness)_

```typescript
interface GuidedQuestionSet {
  id: string;
  reflectionId: string;
  questions: string[];
  generatedAt: string;
  source: "local-ai" | "fallback";
}
```

**Storage**: Encrypted MMKV (`reflection_encrypted`), keyed by `reflectionId`.

---

### FinalReview

_(Existing — documented for completeness. Currently in-memory, MUST be migrated to MMKV.)_

```typescript
interface FinalReview {
  id: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  recurringPatterns: string[];
  triggerThemes: string[];
  nextInquiryPrompts: string[];
  generatedAt: string;
  source: "local-ai" | "fallback";
}
```

**Storage**: MMKV (`review_encrypted`) — **needs migration from current in-memory Map**.

---

### ExportBundle

_(Existing — documented for completeness)_

```typescript
interface ExportBundle {
  id: string;
  periodStart: string;
  periodEnd: string;
  markdownContent: string;
  entryCount: number;
  createdAt: string;
}
```

**Storage**: Generated on-demand, not persisted.

---

## Relationships

```
UserCredential ──────────┐
                         │ (gates access to all below)
                         ▼
ModelConfiguration ──────┐
                         │ (required for AI generation)
                         ▼
AvailableModel ────► (selected by) ────► ModelConfiguration

DeviceInfo ──────────────► (filters) ────► AvailableModel[]

ReflectionEntry ───────┬──► (has) ──────► GuidedQuestionSet
                       │
                       └──► (aggregated into) ──► FinalReview
                                                    │
                       ExportBundle ◄──(contains) ──┘
```

## Storage Map

| Entity             | Storage                          | Encryption               | Notes                           |
| ------------------ | -------------------------------- | ------------------------ | ------------------------------- |
| UserCredential     | MMKV (`auth_credentials`)        | AES-256                  | Password hash + biometric flag  |
| ModelConfiguration | MMKV (`model_config`)            | No (paths only)          | File paths and metadata         |
| DeviceInfo         | Computed at runtime              | N/A                      | Not persisted                   |
| AvailableModel     | Static catalog (code)            | N/A                      | Defined at build time           |
| ReflectionEntry    | MMKV (`reflection_encrypted`)    | AES-256                  | User content                    |
| GuidedQuestionSet  | MMKV (`reflection_encrypted`)    | AES-256                  | Generated content               |
| FinalReview        | MMKV (`review_encrypted`)        | AES-256                  | **MUST migrate from in-memory** |
| ExportBundle       | Generated on-demand              | N/A                      | Not persisted                   |
| rag-content.db     | File in documentDirectory        | No (embeddings, not PII) | Bundled asset                   |
| Model .gguf files  | File in documentDirectory or SAF | No (model weights)       | User-downloaded                 |
