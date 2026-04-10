# Quickstart: AI Chat App

## Architecture Overview

```
┌──────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│ Chat Screen  │────▶│ useChatVm             │────▶│ ChatService      │
│ (root)       │◀────│ (Legend State)        │◀────│ (MMKV CRUD)      │
└──────┬───────┘     └──────────┬────────────┘     └──────────────────┘
       │ push                    │
       │               ┌────────▼────────────┐     ┌──────────────────┐
       │               │ shared/ai/          │────▶│ llama.rn         │
       │               │ - local-ai-runtime  │     │ (native GGUF)    │
       │               │ - model-manager     │     └──────────────────┘
       │               └─────────────────────┘
       │ push
┌──────▼───────┐     ┌───────────────────────┐
│ Model Mgmt   │────▶│ useModelsVm           │
│ Screen       │◀────│ (Legend State)        │
└──────────────┘     └───────────────────────┘
       │ back
┌──────▼───────┐     ┌───────────────────────┐
│ History      │────▶│ useHistoryVm          │
│ Screen       │◀────│ (Legend State)        │
└──────────────┘     └───────────────────────┘
```

**Key boundaries**:

- `shared/ai/` — ALL AI ops (inference, model download, model load/unload)
- `features/chat/service/` — MMKV conversation CRUD only
- `features/model-management/` — Model browsing, download, loading UI
- `features/history/` — Conversation listing, resume, management UI

## Prerequisites

- Node.js 20+ and Bun
- Android Studio or Xcode
- Internet for model download (~350MB for Qwen 2.5 0.5B)
- Device with ≥4GB RAM recommended

## Setup

```bash
bun install
npx tsc --noEmit    # 0 errors
npm test            # all green
```

## Running

```bash
npx expo start
# Press 'a' for Android or 'i' for iOS
```

## First Use Flow

1. Open app → Chat screen appears
2. Tap model badge in header → Model Management screen
3. Select model from catalog → Download starts
4. Wait for download → Tap "Load" → Model loaded into memory
5. Return to Chat → Input enabled
6. Type message → Send → Response streams token-by-token
7. Tap clock icon → History screen → See conversation listed
8. Tap conversation → Returns to Chat with full history

## Key Files

| File                                                    | Purpose                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| `shared/ai/local-ai-runtime.ts`                         | llama.rn wrapper (completion, tokenize)    |
| `shared/ai/model-manager.ts`                            | Model lifecycle (download → verify → load) |
| `features/chat/service/chat-service.ts`                 | MMKV conversation CRUD                     |
| `features/chat/view-model/use-chat-vm.ts`               | Chat state + sendMessage wiring            |
| `features/model-management/view-model/use-models-vm.ts` | Model browsing state                       |
| `features/history/view-model/use-history-vm.ts`         | History list state                         |
