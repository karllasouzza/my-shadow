# Contracts: AI Chat App Internal Interfaces

## ChatService Contract

The `ChatService` mediates persistence and retrieval of conversations. Called by `useChatVm` and `useHistoryVm`.

### `createConversation(modelId: string): ChatConversation`

Creates a new conversation with the specified model. Auto-generates title placeholder from creation timestamp.

**Input**:
- `modelId`: ID of the loaded model (must be currently loaded in llama.rn context)

**Output**:
- `ChatConversation` with empty messages array, `createdAt` and `updatedAt` set to now

**Errors**:
- `MODEL_NOT_LOADED` if no model is currently loaded

---

### `sendMessage(conversationId: string, content: string, onToken?: OnTokenCallback): Promise<SendMessageResult>`

Sends a user message and streams the assistant response.

**Input**:
- `conversationId`: Target conversation
- `content`: User message text (validated for length vs context window before call)
- `onToken`: Optional callback invoked per generated token

**Output**:
```typescript
interface SendMessageResult {
  success: boolean;
  assistantMessage?: string;   // Full generated text
  promptTokens?: number;
  completionTokens?: number;
  error?: AppError;
}
```

**Errors**:
- `CONVERSATION_NOT_FOUND` if conversationId doesn't exist
- `PROMPT_TOO_LONG` if message exceeds context window
- `GENERATION_FAILED` if llama.rn throws during completion
- `MODEL_NOT_LOADED` if model unloaded mid-generation

**Side Effects**:
- Appends `{ role: "user", content }` to conversation messages
- Appends `{ role: "assistant", content: <response> }` after generation
- Updates `updatedAt` timestamp
- Persists to MMKV after each append

---

### `loadConversation(conversationId: string): Promise<ChatConversation | null>`

Loads a full conversation from storage for display or continuation.

**Input**:
- `conversationId`: Target conversation

**Output**:
- `ChatConversation` with all messages, or `null` if not found

**Errors**:
- None (returns null for missing, not error)

---

### `deleteConversation(conversationId: string): Promise<void>`

Permanently removes a conversation and its index entry.

**Input**:
- `conversationId`: Target to delete

**Output**:
- Void on success

**Errors**:
- `CONVERSATION_NOT_FOUND` if already deleted (idempotent, no-op)

**Side Effects**:
- Removes `chat:{id}` key from MMKV
- Removes entry from `chat:index` array

---

### `listConversations(): Promise<ChatConversationIndex[]>`

Returns the lightweight index for the History screen.

**Output**:
- Array of `ChatConversationIndex` sorted by `updatedAt` descending

**Errors**:
- None (returns empty array if no conversations)

---

### `renameConversation(conversationId: string, newTitle: string): Promise<ChatConversation>`

Updates the conversation title.

**Input**:
- `conversationId`: Target
- `newTitle`: New title (max 100 chars)

**Output**:
- Updated `ChatConversation`

**Errors**:
- `VALIDATION_ERROR` if title empty or exceeds 100 chars
- `CONVERSATION_NOT_FOUND` if not found

---

## ModelManager Contract (existing, reused from feature 001)

The `ModelManager` from `features/onboarding/service/model-manager.ts` is reused in-chat for model selection and download. Key methods:

### `downloadModel(url: string, path?: string, onProgress?: (p: number) => void): Promise<Result<string>>`

Downloads a GGUF model to local storage with progress callbacks.

### `verifyModel(filePath: string): Promise<Result<boolean>>`

Checks file existence and non-zero size.

### `loadModel(modelKey: string, filePath: string): Promise<Result<void>>`

Loads a model into llama.rn context via `LocalAIRuntimeService`.

**No changes to this interface** — reused as-is from feature 001.
