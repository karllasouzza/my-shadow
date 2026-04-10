# Data Model: AI Chat App

## Entities

### ChatConversation

Owned by: `features/chat/service/chat-service.ts`
Storage: MMKV key `chat:{id}` → JSON

| Field       | Type            | Description                      | Validation                     |
| ----------- | --------------- | -------------------------------- | ------------------------------ |
| `id`        | `string`        | UUID v4                          | Non-empty, unique              |
| `title`     | `string`        | Auto-generated or custom         | Max 100 chars, non-empty       |
| `createdAt` | `string`        | ISO 8601                         | Valid date, ≤ updatedAt        |
| `updatedAt` | `string`        | ISO 8601                         | Valid date, ≥ createdAt        |
| `modelId`   | `string`        | Model used for this conversation | Non-empty, known model key     |
| `messages`  | `ChatMessage[]` | Ordered messages                 | Non-empty after first exchange |

**State Transitions**: `created` → `active` (first message) → `active` (subsequent) → `deleted` (user deletes)

---

### ChatMessage

Embedded in `ChatConversation.messages`.

| Field       | Type                                | Description            | Validation                  |
| ----------- | ----------------------------------- | ---------------------- | --------------------------- |
| `role`      | `"user" \| "assistant" \| "system"` | Message role           | One of three values         |
| `content`   | `string`                            | Message text           | Non-empty, max 10,000 chars |
| `timestamp` | `string`                            | ISO 8601 creation time | Valid date                  |

**Rules**: System messages only as first message. User messages validated against context window before send. Assistant messages append-only.

---

### ChatConversationIndex

Owned by: `features/chat/service/chat-service.ts` (derived)
Storage: MMKV key `chat:index` → JSON array

| Field       | Type     | Description                      |
| ----------- | -------- | -------------------------------- |
| `id`        | `string` | Links to full `chat:{id}` record |
| `title`     | `string` | Display title                    |
| `updatedAt` | `string` | For sorting (newest first)       |

**Purpose**: Fast history list rendering — avoids loading full conversation bodies.

---

### ModelConfiguration

Owned by: `shared/ai/model-manager.ts`
Storage: MMKV key `model:config` → JSON

| Field               | Type                                                                   | Description                                           |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `id`                | `string`                                                               | Model key (e.g., `qwen2.5-0.5b-instruct`)             |
| `displayName`       | `string`                                                               | Human-readable name                                   |
| `downloadUrl`       | `string`                                                               | HTTPS URL for GGUF download                           |
| `fileSizeBytes`     | `number`                                                               | Expected file size                                    |
| `estimatedRamBytes` | `number`                                                               | Estimated runtime memory                              |
| `localPath`         | `string \| null`                                                       | `file://` path after download, null if not downloaded |
| `downloadStatus`    | `"pending" \| "downloading" \| "completed" \| "failed" \| "cancelled"` | Current status                                        |
| `downloadProgress`  | `number`                                                               | 0-100 percentage                                      |
| `isLoaded`          | `boolean`                                                              | Currently loaded in llama.rn context                  |
| `isActive`          | `boolean`                                                              | Last-used model (restored on app launch)              |
| `lastUsedAt`        | `string \| null`                                                       | ISO 8601 of last use                                  |

**State Transitions**: `pending` → `downloading` (user taps download) → `completed` → `loaded` (user taps load) → `active` (persisted for next session)

**Validation Rules**:

- Disk space ≥ fileSizeBytes before download (FR-014)
- Device RAM ≥ estimatedRamBytes before load, with warning (FR-015)
- File exists and size > 0 after download (verify step)
