# Implementation Plan: voice-message-chat

## Overview

Implement voice message input for the chat UI in incremental steps: utility → hook → components → integration → accessibility → tests. Each step builds on the previous and ends with everything wired together.

## Tasks

- [x] 1. Create `formatDuration` utility
  - Create `features/chat/utils/format-duration.ts` exporting `formatDuration(seconds: number): string`
  - Format as `"M:SS"` where `SS` is zero-padded (e.g. `0` → `"0:00"`, `65` → `"1:05"`, `3600` → `"60:00"`)
  - _Requirements: 5.5_

  - [x] 1.1 Write unit tests for `formatDuration`
    - Test `formatDuration(0)` → `"0:00"`, `formatDuration(65)` → `"1:05"`, `formatDuration(3600)` → `"60:00"`
    - Test boundary: `formatDuration(59)` → `"0:59"`, `formatDuration(60)` → `"1:00"`
    - _Requirements: 5.5_

  - [x] 1.2 Write property test for duration label format (Property 11)
    - **Property 11: Duration label format is correct for all durations**
    - Generate arbitrary non-negative integers (0–3600) with `fc.integer({ min: 0, max: 3600 })`
    - Assert `formatDuration(n)` matches `/^\d+:[0-5]\d$/` and that `formatDuration(m * 60 + s)` produces `"M:SS"` correctly
    - Minimum 100 iterations
    - **Validates: Requirements 5.5**

- [x] 2. Implement `useVoiceInput` hook
  - Create `features/chat/view-model/hooks/useVoiceInput.ts`
  - Define `VoiceInputStatus` type (`"idle" | "recording" | "processing"`) and `UseVoiceInputOptions` / `UseVoiceInputResult` interfaces as specified in the design
  - Create a local Legend State observable (`voiceState$`) with all fields from the design's data model
  - Implement permission check via `AudioModule.getRecordingPermissionsAsync()` before each activation; set `permissionDenied` / `permissionPermanentlyDenied` accordingly and block STT call when denied
  - Implement `onPressIn` / `onPressOut` (long-press) and `onTap` (tap-to-toggle) handlers that drive `idle → recording → processing → idle` transitions
  - Call `startRealtimeTranscription` with `onPartialResult` and `onFinalResult` callbacks; update `partialTranscript` on partial, call `options.onTranscriptReady` on non-empty final, reset to idle on empty final
  - Implement `setInterval`-based duration timer that increments `durationSeconds` every second while `status === "recording"`; clear on state exit
  - Implement `onSwipeUpdate` / `onSwipeEnd` handlers: set `isCancelPreview` when `dx ≤ -40`, trigger cancel (call `stopRealtimeTranscription`, discard transcript, reset to idle) when `dx ≤ -80`
  - Map all error codes to the correct `errorMessage` strings (Brazilian Portuguese) per the design's error code table; reset `status` to `"idle"` within 500 ms; clear `errorMessage` after 3 s
  - Handle `NOT_READY` by setting `noModelPromptVisible: true`; implement `dismissNoModelPrompt` and `confirmModelDownload` (calls `options.onNavigateToModelDownload`)
  - Implement `openSettings` via `Linking.openSettings()`
  - Reset all state and clear timer/interval on unmount (cleanup in `useEffect` return)
  - Use a `cancelFlag` ref to discard in-flight STT results after cancel or unmount
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 2.1 Write unit tests for `useVoiceInput`
    - Verify initial state is `idle` with all fields at defaults
    - Verify `onTranscriptReady` is NOT called when final transcript is empty or whitespace-only
    - Verify `startRealtimeTranscription` is NOT called when permission is denied
    - Verify `noModelPromptVisible` is set to `true` when STT returns `NOT_READY`
    - Verify state resets to `idle` on unmount
    - Verify `errorMessage` is set and cleared after 3 s on error
    - _Requirements: 2.4, 2.5, 7.4, 8.1, 9.4, 10.5_

  - [x] 2.2 Write property test for state machine transitions (Properties 2 & 3)
    - **Property 2: Idle is the only source of `"recording"`**
    - **Property 3: `"recording"` is the only source of `"processing"`**
    - Generate random event sequences (tap, longPressStart, longPressEnd, cancel, finalTranscript, errorCode) using `fc.array(fc.oneof(...))`
    - Apply events to the state machine reducer; assert no transition `idle → processing` or `processing → recording` ever occurs
    - Minimum 100 iterations
    - **Validates: Requirements 2.1, 3.1, 2.2, 3.2, 10.6**

  - [x] 2.3 Write property test for error handling (Property 4)
    - **Property 4: All errors reset state to idle**
    - Generate arbitrary error codes using `fc.constantFrom(...)` over all `AppErrorCode` values
    - Apply each error in `"recording"` and `"processing"` states; assert resulting status is `"idle"`
    - Minimum 100 iterations
    - **Validates: Requirements 7.2, 9.1, 9.2, 9.3**

  - [x] 2.4 Write property test for cancel gesture (Property 5)
    - **Property 5: Cancel gesture always discards and resets to idle**
    - Generate arbitrary `dx` values ≤ -80 using `fc.integer({ max: -80 })`
    - Assert state transitions to `"idle"` and `onTranscriptReady` is never called
    - Minimum 100 iterations
    - **Validates: Requirements 6.2**

  - [x] 2.5 Write property tests for final transcript handling (Properties 6 & 7)
    - **Property 6: Non-empty final transcript triggers submission**
    - **Property 7: Empty final transcript never triggers submission**
    - Generate arbitrary strings with `fc.string()`; assert `onTranscriptReady` called ↔ `trimmed.length > 0`
    - Minimum 100 iterations
    - **Validates: Requirements 2.4, 2.5, 3.3**

  - [x] 2.6 Write property test for permission denied blocking STT (Property 8)
    - **Property 8: Permission denied always blocks STT start**
    - Generate arbitrary activation events (tap, longPress) when permission is denied
    - Assert `startRealtimeTranscription` is never called
    - Minimum 100 iterations
    - **Validates: Requirements 7.4**

- [x] 3. Implement `VoiceInputButton` component
  - Create `features/chat/components/voice-input-button.tsx`
  - Render a `Pressable` with a microphone icon (Lucide `Mic` or equivalent) sized to at least 44×44 pts
  - Wire `onLongPress` → `onPressIn`, `onPressOut` → `onPressOut`, `onPress` (short tap) → `onTap` from props
  - Attach a `PanResponder` to detect horizontal swipe; call `onSwipeUpdate(dx)` on move and `onSwipeEnd(dx)` on release
  - Set `disabled={status === "processing"}` to prevent interaction in processing state
  - Set `accessibilityLabel` per state: `"idle"` → `"Gravar mensagem de voz"`, `"recording"` → `"Parar gravação"`, `"processing"` → `"Processando gravação"`
  - Apply visual style changes per state (e.g. accent color tint when recording)
  - _Requirements: 1.4, 1.5, 2.1, 3.1, 6.1, 10.3, 11.1_

  - [x] 3.1 Write unit tests for `VoiceInputButton`
    - Verify `accessibilityLabel` is correct for each of the three states
    - Verify button is disabled when `status === "processing"`
    - Verify button is enabled when `status === "idle"` or `"recording"`
    - _Requirements: 10.3, 11.1_

  - [x] 3.2 Write property test for accessibilityLabel (Property 10)
    - **Property 10: AccessibilityLabel reflects current state**
    - Generate arbitrary `VoiceInputStatus` values using `fc.constantFrom("idle", "recording", "processing")`
    - Assert label matches the expected Brazilian Portuguese string for each state
    - Minimum 100 iterations
    - **Validates: Requirements 11.1**

  - [x] 3.3 Write property test for processing state disabling button (Property 9)
    - **Property 9: Processing state disables the voice button**
    - Generate arbitrary `"processing"` state inputs; assert `disabled` prop is `true`
    - Also generate `"idle"` and `"recording"`; assert `disabled` is `false`
    - Minimum 100 iterations
    - **Validates: Requirements 10.3**

- [x] 4. Implement `RecordingIndicator` component
  - Create `features/chat/components/recording-indicator.tsx`
  - Use `react-native-reanimated` to implement a continuous pulsing scale/opacity animation while `visible === true`
  - Start animation with `withRepeat(withSequence(...))` on mount / when `visible` becomes `true`; cancel on `visible === false`
  - Apply `opacity: cancelPreview ? 0.5 : 1.0` when `cancelPreview` prop is `true`
  - Set `accessibilityRole="none"` to suppress screen reader announcements
  - Use the app's primary accent color
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.4, 11.2_

  - [x] 4.1 Write unit tests for `RecordingIndicator`
    - Verify `accessibilityRole` is `"none"`
    - Verify component is not rendered (or has `display: none`) when `visible === false`
    - Verify opacity is 0.5 when `cancelPreview === true`
    - _Requirements: 5.1, 5.3, 6.4, 11.2_

- [x] 5. Implement `NoModelPrompt` component
  - Create `features/chat/components/no-model-prompt.tsx`
  - Use the existing `AlertDialog` primitive from `react-native-reusables`
  - Display title and description in Brazilian Portuguese: `"Nenhum modelo de voz carregado. Deseja baixar um agora?"`
  - Confirm button calls `onConfirm`; dismiss/cancel button calls `onDismiss`
  - Show/hide controlled by `visible` prop
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.1 Write unit tests for `NoModelPrompt`
    - Verify dialog is visible when `visible === true`
    - Verify `onConfirm` is called when confirm button is pressed
    - Verify `onDismiss` is called when dismiss button is pressed
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 6. Extend `ChatBottomBar` to wire voice input
  - Import and call `useVoiceInput` inside `ChatBottomBar` (or accept `voiceInput: UseVoiceInputResult` as a prop per the design's extended `ChatBottomBarProps`)
  - Conditionally render `VoiceInputButton` when `value.trim().length === 0`, and `SendButton` when non-empty
  - Show `partialTranscript` in the text input field with italic + reduced-opacity NativeWind classes while `status === "recording"`
  - Show duration label `"Gravando… M:SS"` using `formatDuration(recordingDurationSeconds)` while `status === "recording"`
  - Show cancel hint label `"← Deslize para cancelar"` while `status === "recording"`
  - Show `RecordingIndicator` with `visible={status === "recording"}` and `cancelPreview={isCancelPreview}`
  - Show `NoModelPrompt` with `visible={noModelPromptVisible}` wired to `dismissNoModelPrompt` and `confirmModelDownload`
  - Show `errorMessage` as an inline error label when non-null
  - Show a loading indicator (e.g. `ActivityIndicator`) when `status === "processing"`
  - Disable text keyboard input when `status === "recording"` (set `editable={false}` on the input)
  - Pass `onPressIn`, `onPressOut`, `onTap`, `onSwipeUpdate`, `onSwipeEnd` to `VoiceInputButton`
  - _Requirements: 1.1, 1.2, 1.3, 2.3, 2.6, 4.1, 4.2, 4.3, 4.4, 5.1, 5.5, 6.3, 6.4, 6.5, 7.2, 7.3, 8.1, 9.1, 9.2, 9.3, 10.2, 10.4_

  - [x] 6.1 Write unit tests for `ChatBottomBar` voice integration
    - Verify `VoiceInputButton` is rendered when `value === ""`
    - Verify `SendButton` is rendered when `value === "hello"`
    - Verify partial transcript text is shown with italic/dimmed style during recording
    - Verify loading indicator is shown when `status === "processing"`
    - _Requirements: 1.2, 1.3, 4.3, 2.3_

  - [x] 6.2 Write property test for button visibility (Property 1)
    - **Property 1: Button visibility is determined by text content**
    - Generate arbitrary strings with `fc.string()`
    - Assert `VoiceInputButton` visible ↔ `trimmed.length === 0`, `SendButton` visible ↔ `trimmed.length > 0`
    - Minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3**

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add accessibility announcements
  - In `useVoiceInput` (or `ChatBottomBar`), call `AccessibilityInfo.announceForAccessibility(...)` on state transitions:
    - `idle → recording`: `"Gravação iniciada"`
    - `recording → idle` (completed): `"Gravação concluída"`
    - `recording → idle` (cancelled): `"Gravação cancelada"`
  - _Requirements: 11.3, 11.4, 11.5_

  - [x] 8.1 Write unit tests for accessibility announcements
    - Verify `AccessibilityInfo.announceForAccessibility` is called with `"Gravação iniciada"` on start
    - Verify it is called with `"Gravação concluída"` after a successful recording
    - Verify it is called with `"Gravação cancelada"` after a cancel gesture
    - _Requirements: 11.3, 11.4, 11.5_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with a minimum of 100 iterations each
- All user-facing strings are in Brazilian Portuguese
- The design document contains the full interface signatures and state machine diagram
