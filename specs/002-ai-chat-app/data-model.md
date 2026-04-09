# Data Model: AI Chat App

## Entities

### ChatConversation

Represents a complete conversation with the AI. Persisted as a single MMKV key `chat:{id}`.

| Field | Type | Description | Validation |
|---|---|---|---|
| `id` | `string` | Unique identifier (UUID v4) | Non-empty, unique |
| `title` | `string` | Display title (auto-generated or custom) | Max 100 chars, non-empty |
| `createdAt` | `string` | ISO 8601 timestamp of creation | Valid date, <= updatedAt |
| `updatedAt` | `string` | ISO 8601 timestamp of last message | Valid date, >= createdAt |
| `modelId` | `string` | ID of the model used for this conversation | Non-empty, must match a known model key |
| `messages` | `ChatMessage[]` | Ordered list of messages | Non-empty array after first exchange |

**Relationships**: One-to-many with `ChatMessage` (embedded, not relational).

**State Transitions**:
- `created` → `active` (first message sent)
- `active` → `active` (subsequent messages)
- `active` → `deleted` (user deletes conversation)

---

### ChatMessage

Individual message within a conversation. Embedded in `ChatConversation.messages`.

| Field | Type | Description | Validation |
|---|---|---|---|
| `role` | `"user" \| "assistant" \| "system"` | Message role | Must be one of three values |
| `content` | `string` | Message text | Non-empty, max 10,000 chars |
| `timestamp` | `string` | ISO 8601 creation time | Valid date |

**Validation Rules**:
- System messages only allowed as first message in a conversation
- User messages cannot exceed context window (validated before send via `tokenize()`)
- Assistant messages are append-only (cannot be edited after generation completes)

---

### ChatConversationIndex

Lightweight index entry for the History screen. Stored as JSON array in MMKV key `chat:index`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Conversation ID (links to full `chat:{id}` record) |
| `title` | `string` | Display title |
| `updatedAt` | `string` | For sorting (newest first) |

**Purpose**: Avoid loading full conversation bodies for history list rendering. Only index fields needed for list display. Full conversation loaded on selection.

---

### ModelConfiguration

Catalog entry for a downloadable GGUF model. Persisted in MMKV alongside existing model config.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Model key (e.g., `qwen2.5-0.5b-instruct`) |
| `displayName` | `string` | Human-readable name |
| `downloadUrl` | `string` | HTTPS URL for GGUF download |
| `fileSizeBytes` | `number` | Expected file size for progress calculation |
| `estimatedRamBytes` | `number` | Estimated runtime memory usage |
| `filePath` | `string \| null` | Local file path after download, null if not downloaded |
| `downloadStatus` | `"pending" \| "downloading" \| "completed" \| "failed" \| "cancelled"` | Current status |
| `downloadProgress` | `number` | 0-100 percentage |
| `isLoaded` | `boolean` | Whether model is currently loaded in llama.rn context |
| `lastUsedAt` | `string \| null` | ISO 8601 timestamp of last use |
| `customFolderUri` | `string \| null` | User-provided custom model path |

---

## Validation Rules (from Requirements)

| Rule | Source Requirement | Enforcement Point |
|---|---|---|
| User message fits context window | FR-002, PF-001 | `useChatVm.sendMessage()` — tokenize, compare to `n_ctx - reserved` |
| Disk space before download | FR-014 | `model-manager.ts` — check `expo-file-system` free space API before download |
| RAM warning before load | FR-015 | `use-model-loading-vm.ts` — compare `estimatedRamBytes` to device RAM |
| Conversation title non-empty | FR-006 | Auto-truncate first user message to 50 chars on creation |
| Delete confirmation | FR-010 | `useHistoryVm.deleteConversation()` — require explicit boolean confirmation flag |
| No external network for generation | US5 (Privacy) | `local-ai-runtime.ts` — llama.rn has no HTTP client, purely native inference |
