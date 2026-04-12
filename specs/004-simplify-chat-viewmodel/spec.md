# Feature Specification: Simplify Chat View-Model

**Feature Branch**: `004-simplify-chat-viewmodel`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "1. Criar thinking-toggle e adicionar a opção somente em modelos que contem reasoning 2. Remova toda parte de mmkv e persistencia de use-chat-vm e lá somente deve ficar o codigo da logica da view, não states e thinkingEnabled deve ficar dentro de database/chat 3. Remova toda parte de mmkv e persistencia de use-history-vm 4. O chat deve carregar as mensagens baseando no id recebido por rota e não persistir a conversa atual"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Load conversation by route ID (Priority: P1)

When the user navigates to the chat screen with a conversation ID from the history screen or from a "new conversation" action, the chat loads that specific conversation's messages from storage and displays them. If no ID is provided, the chat starts empty and creates a new conversation when the first message is sent.

**Why this priority**: Core chat functionality — without loading conversations, users cannot resume previous chats or see their message history.

**Independent Test**: Can be fully tested by navigating to chat with a conversation ID and verifying messages load correctly; delivers immediate value of conversation continuity.

**Acceptance Scenarios**:

1. **Given** user navigates to chat with a conversation ID from history, **When** the screen mounts, **Then** the conversation messages are loaded and displayed
2. **Given** user opens chat without a conversation ID (new conversation), **When** the screen mounts, **Then** the chat shows an empty state ready for the first message
3. **Given** user is in a conversation and taps "new conversation", **When** the action completes, **Then** the chat clears and resets to empty state

---

### User Story 2 - Toggle thinking for reasoning models (Priority: P2)

When the loaded model supports reasoning (identified by model tags or metadata), the user sees a toggle button to enable/disable the AI's thinking process. When enabled, the AI shows its step-by-step reasoning before providing the final answer. When disabled, the AI responds directly without showing intermediate thoughts.

**Why this priority**: Enhances user control over AI behavior — power users want to see reasoning, casual users prefer direct answers.

**Independent Test**: Can be fully tested by loading a reasoning-capable model, toggling thinking on/off, sending a message, and verifying the response format changes accordingly.

**Acceptance Scenarios**:

1. **Given** a reasoning-capable model is loaded, **When** the user views the chat header, **Then** a thinking toggle button is visible
2. **Given** thinking is enabled and a reasoning model is loaded, **When** user sends a message, **Then** the AI response includes an expandable "Thoughts" section followed by the answer
3. **Given** thinking is disabled and a reasoning model is loaded, **When** user sends a message, **Then** the AI response contains only the final answer without a "Thoughts" section
4. **Given** a non-reasoning model is loaded, **When** the user views the chat header, **Then** no thinking toggle is shown

---

### User Story 3 - View model persistence removed from VMs (Priority: P3)

All persistent state management (MMKV reads/writes, synced stores) is moved out of view-models and into the database layer. View-models only contain presentation logic and delegate all data operations to database functions. This ensures clean separation of concerns.

**Why this priority**: Architectural improvement — makes codebase maintainable and testable, but doesn't change user-facing behavior directly.

**Independent Test**: Can be verified by inspecting that use-chat-vm.ts and use-history-vm.ts contain no MMKV imports, no observable(synced()) calls, and all persistence happens through database/ module functions.

**Acceptance Scenarios**:

1. **Given** the codebase is reviewed, **When** inspecting use-chat-vm.ts, **Then** it contains no MMKV imports or synced() store definitions
2. **Given** the codebase is reviewed, **When** inspecting use-history-vm.ts, **Then** it contains no MMKV imports or synced() store definitions
3. **Given** thinking toggle state exists, **When** inspected, **Then** it is persisted via database/chat module, not in the view-model

---

### Edge Cases

- What happens when the conversation ID from the route doesn't exist in storage? → Show empty state with error toast, allow user to start new conversation
- How does the system handle a model that doesn't support reasoning tags? → Hide thinking toggle entirely, AI responds without thinking section
- What if the user toggles thinking mid-conversation? → Setting applies to the next message sent, not retroactively
- How does the chat handle a conversation that was deleted while open? → Show error message and reset to new conversation state

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Chat screen MUST read conversation ID from route parameters on mount
- **FR-002**: Chat screen MUST load conversation messages from database using the route ID
- **FR-003**: Chat screen MUST display empty state when no route ID is provided
- **FR-004**: "New Conversation" action MUST clear the current conversation and reset to empty state
- **FR-005**: Thinking toggle MUST only be displayed when the loaded model has "reasoning" or similar tags in its catalog entry
- **FR-006**: When thinking is enabled and model supports reasoning, AI responses MUST include an expandable thoughts section before the main answer
- **FR-007**: When thinking is disabled, AI responses MUST contain only the final answer
- **FR-008**: use-chat-vm.ts MUST NOT contain any MMKV imports or synced() store definitions
- **FR-009**: use-history-vm.ts MUST NOT contain any MMKV imports or synced() store definitions
- **FR-010**: Thinking toggle state MUST be persisted in database/chat module, not in view-models
- **FR-011**: All data persistence for conversations MUST happen through database/chat.ts functions
- **FR-012**: View-models MUST only contain presentation logic (event handlers, derived state for display)

### Key Entities

- **ChatConversation**: A conversation thread with an ID, title, timestamps, model ID, and ordered list of messages. Loaded/saved via database/chat module.
- **ChatMessage**: An individual message within a conversation with role (user/assistant/system), content, optional thinking field, and timestamp.
- **ModelCatalogEntry**: A model definition from the catalog including id, display name, tags (including reasoning capability indicators), and HuggingFace identifier.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Chat screen loads and displays conversation messages within 500ms of navigation
- **SC-002**: Zero MMKV or synced() imports remain in use-chat-vm.ts and use-history-vm.ts (verifiable via grep)
- **SC-003**: Thinking toggle is visible only when a reasoning-capable model is loaded (verified by model tags)
- **SC-004**: Users can toggle thinking on/off and observe the difference in AI response format within one message send cycle
- **SC-005**: 100% of conversation persistence logic resides in database/chat.ts (verified via code review)

## Assumptions

- Models in the catalog have a `tags` array that includes indicators like "reasoning", "thinking", or "chain-of-thought" to identify reasoning capability
- The existing database/chat.ts module already provides all necessary CRUD functions (load, save, create, delete, append)
- Route parameters are passed via expo-router's standard navigation params system
- Users expect the thinking toggle state to persist across app sessions (handled by database layer, not VM)
- Non-reasoning models simply ignore any thinking-related prompts and respond directly
- The `thinking` field on ChatMessage is optional and only populated when thinking is enabled and the model produces reasoning output
