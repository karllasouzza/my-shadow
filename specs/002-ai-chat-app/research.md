# Research: AI Chat App Restructure

## Decision 1: Route Structure for Chat + History Stack Navigation

**Decision**: Use Expo Router route group `(chat)` with stack-based navigation. Chat at `index.tsx` (root), History at `history.tsx` (pushed from header button).

**Rationale**:
- Expo Router v6 supports stack navigation via `useRouter().push()` within route groups
- Route groups `(chat)` allow shared layout without URL path pollution
- `router.back()` cleanly returns from History to active Chat
- Existing `_layout.tsx` can redirect root to `(chat)/` without breaking deeplinking

**Alternatives considered**:
- Bottom tabs: Rejected per clarification session — user wants stack, not parallel destinations
- Modal overlay for history: Rejected — harder to navigate deep into conversation details, conflicts with modal-based model picker

---

## Decision 2: In-Chat Model Picker Presentation

**Decision**: Model picker is a modal sheet (React Native modal or @rn-primitives dialog) triggered from the Chat header when no model is loaded or user taps model name badge.

**Rationale**:
- Modal keeps user in the Chat context — no route change needed
- Matches existing pattern: onboarding already uses modal for model selection
- Download progress, RAM warnings, and model list fit naturally in a scrollable sheet
- Can be dismissed without losing chat context

**Alternatives considered**:
- Inline panel above input: Rejected — reduces chat area, awkward on small screens
- Separate route: Rejected — loses chat context, requires navigation state preservation

---

## Decision 3: Streaming Token Rendering Strategy

**Decision**: Use llama.rn `onToken` callback to append tokens to a Legend State observable. The Chat screen binds a `FlatList` to the observable's message array with `keyExtractor` on message ID. New tokens update the "pending assistant message" item in-place.

**Rationale**:
- llama.rn `context.completion()` supports streaming callback — already implemented in `local-ai-runtime.ts`
- Legend State provides fine-grained reactivity without full re-render — only the active message bubble updates
- FlatList with `removeClippedSubviews` handles long conversations efficiently
- In-place token append avoids flicker (no list re-keying)

**Alternatives considered**:
- Full message re-render per token: Rejected — would cause visible flicker and jank at 5-10 tokens/sec
- ScrollView with manual append: Rejected — FlatList virtualization needed for long conversations (1000+ messages)

---

## Decision 4: Conversation Persistence Format

**Decision**: Each conversation is a single MMKV key `chat:{id}` storing a JSON object with `{ id, title, createdAt, updatedAt, modelId, messages: [{ role, content, timestamp }] }`. A separate index key `chat:index` stores `{ id, title, updatedAt }[]` for the history list.

**Rationale**:
- MMKV is synchronous, fast, and already used in project for model config
- Index key avoids loading full conversation bodies for history list (performance budget <500ms for 100 items)
- JSON serialization is simple and sufficient for text-only messages
- Flat structure avoids relational complexity — conversations are independent

**Alternatives considered**:
- SQLite: Rejected — overkill for text-only data, adds migration complexity, MMKV already in dependency tree
- One key per conversation without index: Rejected — would require reading all conversations to build history list, violating <500ms budget

---

## Decision 5: Removal Strategy for Reflection, Review, Onboarding

**Decision**: Delete `features/reflection/`, `features/review/`, and most of `features/onboarding/view/` (keep model-manager and use-model-loading-vm). Audit all imports across `app/`, `features/`, and `tests/` with a grep sweep. Update `app/_layout.tsx` to remove old routes.

**Rationale**:
- Clarification session confirmed: no reflection logic is reused
- Model management (download, verify, load) is the only onboarding concern retained
- Grep sweep ensures no dangling imports slip through
- Tests for deleted features are removed alongside source

**Alternatives considered**:
- Archive behind feature flag: Rejected — adds bundle bloat, no product need
- Keep reflection as separate mode: Rejected per clarification — user wants clean slate

---

## Decision 6: Chat Auto-Title Generation

**Decision**: Auto-generate conversation title from first user message (truncate to 50 chars). User can rename later from History screen.

**Rationale**:
- No external AI call needed for title (avoids extra generation cost)
- First message is the strongest signal for conversation topic
- 50-char limit fits history list rows without truncation UI
- Matches behavior of mainstream chat apps (ChatGPT, Claude)

**Alternatives considered**:
- Separate AI call to summarize: Rejected — doubles generation cost, unnecessary complexity
- "Conversation N" placeholder: Rejected — unhelpful for finding specific past conversations
