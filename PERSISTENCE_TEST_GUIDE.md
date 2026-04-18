# Conversation Persistence Test Guide

## Problem Fixed
Conversations and messages were not persisting due to improper Observable mutation patterns in Legend State. The mutations were not triggering reactivity, so MMKV persistence was never invoked.

## What Changed

### 1. Observable Mutation Patterns (Phase 1)
- `addMessage()` - Returns new ChatConversation with immutable messages array
- `updateLastUserError()` - Uses map() to create new messages array
- `removeLastAssistant()` - Uses filter() instead of splice()

**Why**: Legend State requires new object references to detect changes and trigger persistence sync.

### 2. Persistence Configuration (Phase 2)
- Added `mode: "merge"` to prevent accidental state resets
- Added `debounceMs: 500` to batch writes efficiently
- Added lifecycle callbacks for visibility into persist operations
- Added `onError` handler for recovery

### 3. Debug Logging (Phase 3)
- `addMessage()` logs conversation count before/after mutation
- All operations log via `aiDebug()` to console
- Search console for `PERSIST:` and `CONVERSATION:` to verify operations

---

## Manual Testing Steps

### Test 1: Single Conversation Creation & Persistence

**Procedure:**
1. Build and run the app: `expo run:android` or `expo run:ios`
2. On chat screen, send a message: "Hello world"
3. **Verify in console**: Look for logs like:
   ```
   CONVERSATION:addMessage:updating - convId=xxx msgCount=1 role=user
   PERSIST:save:start
   PERSIST:save:end - Saved 1 conversations to MMKV
   ```
4. Open History tab (swipe left or tap History button)
5. **Expected**: Conversation appears in history with your message preview
6. Tap the conversation in history
7. **Expected**: Chat screen loads with your message visible
8. Go back to History
9. **Expected**: Conversation still appears (not deleted)

**If fails**: Check console for `PERSIST:error` or `CONVERSATION:addMessage:skip`

---

### Test 2: Navigation Round-Trip (Core Bug Test)

**Procedure:**
1. On chat screen, send message: "Test navigation"
2. Wait for response (or send another message)
3. Tap "History" button
4. **Expected**: Conversation appears in list immediately
5. Tap conversation in history
6. **Expected**: All messages visible (not reset to empty)
7. Go back to History using back button
8. **Expected**: Conversation still exists
9. Tap History button again from chat screen
10. **Expected**: Same conversation visible

**If fails**: This is the bug - state was reset during navigation. Check:
- Are `onLoadStart`/`onLoadEnd` logs appearing?
- Are mutations returning `{ ...prev, [convId]: ... }` correctly?

---

### Test 3: App Restart Persistence

**Procedure:**
1. Send a message: "Test restart"
2. See it in history
3. **Force close the app** (don't just background it)
4. Reopen the app
5. **Expected**: Conversation appears automatically in history on cold start
6. Tap conversation
7. **Expected**: Message still there

**If fails**: MMKV is not persisting. Check:
- Is MMKV key `"chat_conversations"` being written? (check React Native debugger Storage tab)
- Are `PERSIST:save:` logs appearing during chat operations?
- Are `PERSIST:load:` logs appearing on app startup?

---

### Test 4: Multiple Conversations

**Procedure:**
1. Send message: "Conversation 1"
2. Tap "+" button to create new conversation
3. Send message: "Conversation 2"
4. Go to History
5. **Expected**: Both conversations appear in list, newest first
6. Tap first conversation
7. **Expected**: "Conversation 2" message visible
8. Back to history
9. Tap second conversation
10. **Expected**: "Conversation 1" message visible

---

### Test 5: Conversation Deletion Still Works

**Procedure:**
1. Create a conversation with a message
2. Go to History
3. Long-press or tap menu on conversation
4. Tap "Delete"
5. Confirm deletion
6. **Expected**: Conversation disappears from list immediately
7. Restart app
8. **Expected**: Conversation does not reappear (properly deleted from MMKV)

---

## Console Debugging

### Key Log Patterns to Watch

**Successful persistence cycle:**
```
CONVERSATION:addMessage:updating - convId=abc123... msgCount=1 role=user
CONVERSATION:addMessage:done - success=true convCount=0->1
PERSIST:save:start
PERSIST:save:end - Saved 1 conversations to MMKV
```

**App startup with existing data:**
```
PERSIST:load:start
PERSIST:load:end - Loaded 1 conversations from MMKV
```

**Error scenarios:**
```
PERSIST:error - Persistence error: [error message]
CONVERSATION:addMessage:skip - Conversation xxx not found
```

### How to View Logs

**React Native Debugger (Web):**
1. Open Metro bundler web interface: http://localhost:19000/
2. Enable debugging
3. Console tab shows all `aiDebug()` and `aiError()` calls

**React Native CLI:**
```bash
npx react-native log-ios  # iOS
npx react-native log-android  # Android
```

---

## Regression Checks

After these changes, verify nothing else broke:

1. **Rename conversation** - Still works in History tab
2. **Retry last message** - Still works (uses `removeLastAssistant()`)
3. **Model switching** - New conversations with different models persist
4. **Reasoning toggle** - Setting persists across navigation

---

## Expected Timeline

- ✅ **Phase 1 (Observable mutations)**: Conversations should immediately appear in History after first message
- ✅ **Phase 2 (Persistence hardening)**: Data survives navigation and app restart
- ✅ **Phase 3 (Debug logging)**: Console shows clear visibility into persistence operations

If any test fails, the console logs will indicate which phase is broken.
