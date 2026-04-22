# Requirements Document

## Introduction

This feature adds a voice message input to the chat UI, allowing users to speak instead of type. The user presses and holds (or taps to toggle) a microphone button in the chat input area, speaks, and the transcribed text is sent as a chat message. Live partial transcription is shown while recording. The feature integrates with the existing `Realtime_Transcriber` module (`shared/ai/stt/realtime.ts`) and the `Whisper_Runtime` already provided by the `ai-model-manager-stt` spec.

## Glossary

- **Voice_Input_Button**: The microphone icon button rendered inside the chat input area that initiates and terminates voice recording.
- **Recording_Session**: The period between the user activating the Voice_Input_Button and either confirming or cancelling the recording.
- **Partial_Transcript**: The intermediate transcription text emitted by the Realtime_Transcriber via `onPartialResult` during an active Recording_Session.
- **Final_Transcript**: The definitive transcription text emitted by the Realtime_Transcriber via `onFinalResult` when a Recording_Session ends normally.
- **Recording_Indicator**: The visual element displayed during an active Recording_Session (pulsing animation or waveform) that communicates recording state to the user.
- **Cancel_Gesture**: A swipe-left gesture performed on the Voice_Input_Button during a Recording_Session that discards the recording without sending a message.
- **Chat_Input**: The existing text input area at the bottom of the chat screen where users compose messages.
- **Realtime_Transcriber**: The module at `shared/ai/stt/realtime.ts` that captures microphone audio and emits `onPartialResult` and `onFinalResult` callbacks.
- **Whisper_Runtime**: The singleton at `shared/ai/stt/runtime.ts` that manages the loaded Whisper model.
- **Model_Manager**: The module at `shared/ai/manager.ts` responsible for downloading and managing AI models.
- **Voice_Input_State**: The Legend State observable that tracks the current state of the voice input UI (`idle`, `recording`, `processing`).

---

## Requirements

### Requirement 1: Voice Input Button

**User Story:** As a user, I want a microphone button in the chat input area, so that I can initiate voice recording without leaving the chat screen.

#### Acceptance Criteria

1. THE Chat_Input SHALL render a Voice_Input_Button alongside the existing text input and send button.
2. WHEN the Chat_Input text field contains one or more characters, THE Chat_Input SHALL hide the Voice_Input_Button and show the send button exclusively.
3. WHEN the Chat_Input text field is empty, THE Chat_Input SHALL show the Voice_Input_Button in place of the send button.
4. THE Voice_Input_Button SHALL be accessible with a minimum touch target of 44×44 points.
5. THE Voice_Input_Button SHALL display a microphone icon that visually distinguishes it from the send button.

---

### Requirement 2: Press-and-Hold Recording Interaction

**User Story:** As a user, I want to press and hold the microphone button to record, so that recording stops automatically when I release my finger.

#### Acceptance Criteria

1. WHEN the user performs a long-press gesture on the Voice_Input_Button, THE Voice_Input_Button SHALL call `startRealtimeTranscription` from the Realtime_Transcriber and transition the Voice_Input_State to `recording`.
2. WHEN the user releases the Voice_Input_Button while Voice_Input_State is `recording` and no Cancel_Gesture was performed, THE Voice_Input_Button SHALL call `stopRealtimeTranscription` and transition the Voice_Input_State to `processing`.
3. WHEN Voice_Input_State transitions to `processing`, THE Chat_Input SHALL display a loading indicator until the Final_Transcript is received.
4. WHEN the Final_Transcript is received and its trimmed length is greater than zero, THE Chat_Input SHALL populate the text field with the Final_Transcript and submit the message automatically.
5. WHEN the Final_Transcript is received and its trimmed length equals zero, THE Chat_Input SHALL discard the result and transition the Voice_Input_State back to `idle` without sending a message.
6. WHEN Voice_Input_State transitions back to `idle`, THE Chat_Input SHALL restore the Voice_Input_Button to its default appearance.

---

### Requirement 3: Tap-to-Toggle Recording Interaction

**User Story:** As a user, I want to tap the microphone button to start recording and tap again to stop, so that I can record hands-free without holding the button.

#### Acceptance Criteria

1. WHEN the user performs a short tap on the Voice_Input_Button while Voice_Input_State is `idle`, THE Voice_Input_Button SHALL call `startRealtimeTranscription` and transition the Voice_Input_State to `recording`.
2. WHEN the user performs a short tap on the Voice_Input_Button while Voice_Input_State is `recording`, THE Voice_Input_Button SHALL call `stopRealtimeTranscription` and transition the Voice_Input_State to `processing`.
3. THE Chat_Input SHALL apply the same Final_Transcript handling described in Requirement 2, criteria 4 and 5, for tap-to-toggle sessions.

---

### Requirement 4: Live Transcription Display

**User Story:** As a user, I want to see the transcription text appear in real time as I speak, so that I can confirm the system is capturing my words correctly.

#### Acceptance Criteria

1. WHILE Voice_Input_State is `recording`, THE Chat_Input SHALL display the current Partial_Transcript text in the text input field.
2. WHEN a new Partial_Transcript is received from the Realtime_Transcriber, THE Chat_Input SHALL update the displayed text within 600 ms of receiving the callback.
3. WHILE Voice_Input_State is `recording`, THE Chat_Input SHALL render the Partial_Transcript text in a visually distinct style (e.g., italic or reduced opacity) to indicate it is not yet final.
4. WHEN Voice_Input_State transitions from `recording` to `processing`, THE Chat_Input SHALL replace the Partial_Transcript display with a loading indicator.

---

### Requirement 5: Recording Visual Feedback

**User Story:** As a user, I want a clear visual indicator while recording is active, so that I know the app is listening to my voice.

#### Acceptance Criteria

1. WHILE Voice_Input_State is `recording`, THE Recording_Indicator SHALL be visible in the chat input area.
2. THE Recording_Indicator SHALL animate continuously (pulsing scale or opacity animation) while Voice_Input_State is `recording`.
3. WHEN Voice_Input_State transitions out of `recording`, THE Recording_Indicator SHALL stop animating and become hidden.
4. THE Recording_Indicator SHALL use the app's primary accent color to draw attention.
5. WHILE Voice_Input_State is `recording`, THE Chat_Input SHALL display a label in Brazilian Portuguese indicating the recording duration in seconds (e.g., "Gravando… 0:03").

---

### Requirement 6: Cancel Gesture

**User Story:** As a user, I want to cancel a recording by sliding left, so that I can discard an unwanted recording without sending it.

#### Acceptance Criteria

1. WHILE Voice_Input_State is `recording`, THE Voice_Input_Button SHALL detect a horizontal swipe-left gesture with a minimum displacement of 80 points.
2. WHEN the Cancel_Gesture is detected, THE Voice_Input_Button SHALL call `stopRealtimeTranscription`, discard the Final_Transcript, and transition the Voice_Input_State to `idle` without sending any message.
3. WHILE Voice_Input_State is `recording`, THE Chat_Input SHALL display a cancel hint label in Brazilian Portuguese (e.g., "← Deslize para cancelar").
4. WHEN the Cancel_Gesture displacement exceeds 40 points during a drag, THE Recording_Indicator SHALL reduce its opacity to 0.5 to preview the cancellation.
5. WHEN the Cancel_Gesture is completed, THE Chat_Input SHALL briefly display a confirmation label in Brazilian Portuguese (e.g., "Gravação cancelada") for 1500 ms before returning to the idle state.

---

### Requirement 7: Microphone Permission Handling

**User Story:** As a user, I want the app to request microphone permission gracefully, so that I understand why the permission is needed and can grant it without confusion.

#### Acceptance Criteria

1. WHEN the user activates the Voice_Input_Button for the first time and microphone permission has not been determined, THE Chat_Input SHALL request microphone permission via the system dialog before calling `startRealtimeTranscription`.
2. IF microphone permission is denied and `startRealtimeTranscription` returns `err` with code `PERMISSION_DENIED`, THEN THE Chat_Input SHALL display an inline error message in Brazilian Portuguese (e.g., "Permissão de microfone negada. Habilite nas configurações.") and transition the Voice_Input_State to `idle`.
3. IF microphone permission is permanently denied, THEN THE Chat_Input SHALL display a button labeled "Abrir Configurações" that opens the device application settings screen.
4. THE Chat_Input SHALL NOT call `startRealtimeTranscription` when microphone permission is known to be denied.

---

### Requirement 8: No Whisper Model Loaded

**User Story:** As a user, I want to be informed when no speech model is available, so that I can download one and use voice input.

#### Acceptance Criteria

1. IF `startRealtimeTranscription` returns `err` with code `NOT_READY`, THEN THE Chat_Input SHALL display a bottom sheet or inline prompt in Brazilian Portuguese explaining that a Whisper model is required (e.g., "Nenhum modelo de voz carregado. Deseja baixar um agora?").
2. WHEN the user confirms the download prompt, THE Chat_Input SHALL navigate the user to the model download screen.
3. WHEN the user dismisses the download prompt, THE Chat_Input SHALL transition the Voice_Input_State to `idle` without sending a message.
4. THE Chat_Input SHALL NOT display the download prompt more than once per Recording_Session attempt.

---

### Requirement 9: Error Handling During Recording

**User Story:** As a user, I want the app to recover gracefully from recording errors, so that a failure does not leave the UI in a broken state.

#### Acceptance Criteria

1. IF `startRealtimeTranscription` returns any `err` result other than `PERMISSION_DENIED` or `NOT_READY`, THEN THE Chat_Input SHALL display a generic error message in Brazilian Portuguese (e.g., "Erro ao iniciar gravação. Tente novamente.") and transition the Voice_Input_State to `idle`.
2. IF the Realtime_Transcriber emits an `OUT_OF_MEMORY` error during an active Recording_Session, THEN THE Chat_Input SHALL stop the Recording_Indicator, display an error message in Brazilian Portuguese (e.g., "Memória insuficiente. Gravação encerrada."), and transition the Voice_Input_State to `idle`.
3. IF `stopRealtimeTranscription` returns an `err` result, THEN THE Chat_Input SHALL discard any partial transcript, display a generic error message in Brazilian Portuguese, and transition the Voice_Input_State to `idle`.
4. WHEN any error occurs during a Recording_Session, THE Chat_Input SHALL ensure the Voice_Input_State is `idle` and the Voice_Input_Button is interactive within 500 ms of the error.

---

### Requirement 10: Voice Input State Management

**User Story:** As a developer, I want voice input state managed via Legend State, so that the UI reacts consistently to state changes across components.

#### Acceptance Criteria

1. THE Voice_Input_State SHALL be a Legend State observable with values `"idle"`, `"recording"`, and `"processing"`.
2. WHEN Voice_Input_State is `"recording"`, THE Chat_Input SHALL disable the text keyboard and prevent manual text entry.
3. WHEN Voice_Input_State is `"processing"`, THE Chat_Input SHALL disable the Voice_Input_Button and prevent a new Recording_Session from starting.
4. WHEN Voice_Input_State is `"idle"`, THE Chat_Input SHALL re-enable all interactive elements.
5. THE Voice_Input_State SHALL be reset to `"idle"` whenever the chat screen is unmounted.
6. FOR ALL valid sequences of state transitions (`idle` → `recording` → `processing` → `idle`), THE Voice_Input_State SHALL never transition directly from `idle` to `processing` or from `processing` to `recording`.

---

### Requirement 11: Accessibility

**User Story:** As a user with accessibility needs, I want the voice input controls to be usable with screen readers, so that I can use voice input regardless of visual ability.

#### Acceptance Criteria

1. THE Voice_Input_Button SHALL have an `accessibilityLabel` in Brazilian Portuguese that reflects its current state (e.g., "Gravar mensagem de voz" when idle, "Parar gravação" when recording).
2. THE Recording_Indicator SHALL have `accessibilityRole` set to `"none"` to prevent screen readers from announcing the animation.
3. WHEN Voice_Input_State transitions to `recording`, THE Chat_Input SHALL post an accessibility announcement in Brazilian Portuguese (e.g., "Gravação iniciada").
4. WHEN Voice_Input_State transitions to `idle` after a completed recording, THE Chat_Input SHALL post an accessibility announcement in Brazilian Portuguese (e.g., "Gravação concluída").
5. WHEN Voice_Input_State transitions to `idle` after a cancelled recording, THE Chat_Input SHALL post an accessibility announcement in Brazilian Portuguese (e.g., "Gravação cancelada").
