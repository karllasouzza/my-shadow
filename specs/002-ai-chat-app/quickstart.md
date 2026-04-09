# Quickstart: AI Chat App Feature

## Prerequisites

- Node.js 20+ and Bun installed
- Expo CLI (`npx expo`)
- Android Studio (Android emulator/device) or Xcode (iOS simulator)
- Stable internet for initial model download (~350MB for Qwen 2.5 0.5B)
- Device with ≥4GB RAM recommended

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Verify TypeScript compilation
npx tsc --noEmit

# 3. Run existing test suite (ensure baseline is green before changes)
npm test
```

## Running the App (Development)

```bash
# Start Expo dev server
npx expo start

# Press 'a' for Android or 'i' for iOS
# Or scan QR code with Expo Go app
```

## Running Tests

```bash
# Full test suite
npm test

# Single feature tests
npm test -- tests/unit/chat/
npm test -- tests/integration/chat/
npm test -- tests/e2e/chat/
```

## First Chat Flow (Manual Test)

1. **Open app** → Chat screen appears
2. **No model loaded** → Model picker modal appears automatically
3. **Select a model** from catalog (e.g., Qwen 2.5 0.5B)
4. **Download starts** → Watch progress bar (may take 1-3 minutes on 4G)
5. **Model loads** → Chat input becomes enabled
6. **Type a message** → Press send
7. **Response streams** → Tokens appear progressively in assistant bubble
8. **Check history** → Tap history icon in header → See conversation listed
9. **Resume conversation** → Tap conversation → Returns to chat with full message history

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Chat Screen  │────▶│ useChatVm        │────▶│ ChatService      │
│ (index.tsx)  │◀────│ (Legend State)   │◀────│ (MMKV storage)   │
└──────┬───────┘     └────────┬─────────┘     └──────────────────┘
       │                      │
       │               ┌──────▼──────────┐     ┌──────────────────┐
       │               │ LocalAIRuntime   │────▶│ llama.rn         │
       │               │ (llama wrapper)  │     │ (native GGUF)    │
       │               └─────────────────┘     └──────────────────┘
       │
       │ push           ┌──────────────────┐     ┌──────────────────┐
       └───────────────▶│ History Screen   │────▶│ useHistoryVm     │
         (header btn)   │ (history.tsx)    │     │ (MMKV index)     │
                        └──────────────────┘     └──────────────────┘
```

## Key Files

| File | Purpose |
|---|---|
| `src/app/(chat)/index.tsx` | Chat screen (root route) |
| `src/app/(chat)/history.tsx` | History screen (stack-pushed) |
| `src/features/chat/view-model/use-chat-vm.ts` | Chat state management |
| `src/features/chat/service/chat-service.ts` | Conversation persistence |
| `src/shared/ai/local-ai-runtime.ts` | llama.rn wrapper (existing, reused) |
| `src/features/onboarding/service/model-manager.ts` | Model download/verify/load (existing, reused) |

## Feature Flags / Configuration

No feature flags — this replaces the app's primary flow entirely.

## Known Limitations

- Model download cannot be resumed if interrupted (must restart download)
- Conversations are device-local only — no cloud sync
- No multi-modal support (text only, no images or audio)
