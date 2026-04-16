# Feature Specification: Local AI Chat Assistant

**Feature Branch**: `local-ai-chat`
**Created**: 2026-04-15
**Status**: Draft
**Input**: Implement an AI chat assistant with history, model management and voice mode to let users use local AI with privacy and velocity.

## Clarifications

### Session 2026-04-15

- Q: What trust model should we require for model artifacts? → A: For app v1, accept only developer-signed model artifacts; the app verifies signatures and checksums and rejects unsigned or tampered artifacts.
- Q: Which key management approach should we use for keys and exported artifacts? → A: Hybrid — platform secure keystore by default (non-exportable); optional user-passphrase-protected export for portability.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conversational Chat (Priority: P1)

A user can open the app, select an active local model, send messages, and receive model-generated replies. Conversation history is saved locally and can be resumed later.

**Why this priority**: Core user value — ability to interact with a local assistant while preserving privacy and speed.

**Independent Test**: With a device that has a local model installed, send a text message and verify a model response appears and the message pair is persisted across app restart.

**Acceptance Scenarios**:

1. **Given** the app has at least one installed model and the user is on the chat screen, **When** the user types a message and taps send, **Then** the UI shows a pending response and then the model's reply appears in the chat history.
2. **Given** the app is restarted, **When** the user re-opens the same conversation, **Then** previous messages are present and in the correct order.
3. **Given** the device goes offline, **When** the user sends a message using a downloaded model, **Then** the assistant responds locally and no network requests containing user content occur.

---

### User Story 2 - Model Management (Priority: P2)

A user can view available local models, download or delete models, and switch the active model for a conversation.

**Why this priority**: Enables control over performance and privacy (smaller models for faster responses, larger ones for quality).

**Independent Test**: Open model manager, download a model, switch active model, and verify subsequent messages are processed by the selected model (indicated in UI).

**Acceptance Scenarios**:

1. **Given** no models installed, **When** the user opens Model Management, **Then** the UI lists downloadable models and shows size/estimated inference performance.
2. **Given** multiple models installed, **When** the user selects a different active model, **Then** subsequent messages use the newly selected model.
3. **Given** a model is deleted, **When** the user tries to use it, **Then** the app prompts to re-download or choose another model.

---

### User Story 3 - Voice Mode (Priority: P3)

A user can speak to the assistant and receive audio playback of the assistant's reply. Voice mode supports push-to-talk and continuous transcription modes.

**Why this priority**: Complements text-first chat and improves accessibility and speed of input/consumption.

**Independent Test**: Enable voice mode, speak a query, and verify the message is transcribed, sent to the local model, and a spoken response is played back.

**Acceptance Scenarios**:

1. **Given** microphone permission granted, **When** the user taps the mic and speaks, **Then** the speech is transcribed to text and appears as a pending user message.
2. **Given** the assistant reply is ready, **When** TTS is enabled, **Then** the response is played back via device audio without external network calls containing user speech.
3. **Given** voice input fails (low quality), **When** the user reviews transcription, **Then** they can edit the transcribed text before sending.

---

### Edge Cases

- Model artifacts exceed device storage — present a clear UI prompt and suggest alternatives (smaller models, external storage).
- Low-memory situations during inference — fallback to a smaller model or a short pre-canned reply template.
- Microphone access denied — present settings link and fallback to text-only input.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST process user text queries using a local model on-device and display replies in the chat UI.
- **FR-002**: Conversation history MUST be persisted locally, encrypted at rest, and available offline across restarts.
- **FR-003**: Users MUST be able to view, download, delete, and switch between available local models.
- **FR-004**: Model downloads and deletions MUST be resumable and report progress to the user.
- **FR-005**: The app MUST provide a voice input mode that transcribes user speech and can play assistant replies as audio.
- **FR-006**: The app MUST NOT transmit user content (messages or raw audio) to external services, except for explicit model downloads (see constraints).
- **FR-007**: Model downloads and updates MUST be manual and initiated explicitly by the user; the UI may notify about available updates but must not start downloads without user consent.
- **FR-008**: STT and TTS MUST be local-only: speech-to-text and text-to-speech processing MUST occur on-device and audio or transcriptions MUST NOT be sent to external services as part of normal operation.
- **FR-009**: Conversation retention default: Retain conversations indefinitely until the user chooses to delete them; provide user controls to export or delete conversations.
- **FR-009**: Conversation retention default: Retain conversations indefinitely until the user chooses to delete them; provide user controls to export or delete conversations.
- **FR-010**: For app v1, the app MUST accept only developer-signed model artifacts. The model manager MUST verify signatures and checksums before installing or activating a model; unsigned or tampered artifacts MUST be rejected and the user informed.
- **FR-011**: Key management policy: Encryption keys for conversation storage and model artifacts MUST use the platform secure keystore (Secure Enclave / Android Keystore) by default (non-exportable). Provide an optional user-passphrase-derived export mechanism (strong KDF + authenticated encryption) for portability; cloud-managed keys are not permitted by default for v1.

### Key Entities _(include if feature involves data)_

- **Conversation**: id, title, lastUpdatedAt, activeModelId, metadata
- **Message**: id, conversationId, role (user/assistant/system), text, audioBlobRef?, timestamp, persisted
- **Model**: id, name, sizeBytes, version, performanceEstimate, installedPath, checksum
- **ModelArtifact**: downloadUrl (developer-maintained), localPath, status (idle/downloading/installed/failed)
- **ModelArtifact**: downloadUrl (developer-maintained), localPath, status (idle/downloading/installed/failed), checksum, signatureMetadata (signedBy, signatureUrl or detachedSignature), signatureVerifiedAt
- **DeviceProfile**: deviceId, freeStorageBytes, cpuTier, supportsHardwareAcceleration

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of user text queries receive a local model reply within 15 seconds (p95) on target devices with the model installed.
- **SC-002**: Switching the active model completes (model activated or warm-started) within 5 seconds for an already-installed model.
- **SC-003**: Conversation messages are persisted locally within 2 seconds after send in 99% of cases.
- **SC-004**: Voice mode end-to-end latency (user stop → assistant audio start) is under 5 seconds (p95) when local STT/TTS are used.
- **SC-005**: No user content is sent outside the device during normal chat and voice flows (verified by a simple network capture test).

## Assumptions

- Devices will have sufficient storage for at least one local model; users may be prompted to free space for downloads.
- Users grant microphone permission for voice mode when they opt into it.
- Model downloads and updates are user-initiated; offline installs from external files are supported.
- Model downloads and updates are user-initiated; offline installs from external files are supported but for v1 these artifacts MUST be developer-signed and pass signature verification before installation.
- Encryption keys are stored in the platform keystore by default (non-exportable). When a user requests export/transfer, the app MUST require a user passphrase and encrypt exported key material using a strong KDF (e.g., scrypt or PBKDF2) and authenticated encryption (e.g., AES-GCM).
- Preferred local engines (non-normative): Whisper.rn for STT, `expo-speech-recognition` as a lightweight fallback for low-end devices, and `expo-speech` for local TTS.
- The product follows the project constitution: code/docs in English, UI text in pt-BR, micro-components, and strict local-first privacy rules.

---

## Constraints (mandatory)

- **C-001**: All commits, inline comments, and documentation MUST be written in English.
- **C-002**: All user-facing text (UI strings, labels, helper text) MUST be in Brazilian Portuguese (pt-BR).
- **C-003**: Implementation MUST prefer micro-components and micro-logics (single responsibility).
- **C-004**: No user data (messages or audio) SHALL be transmitted to external endpoints, except explicit model downloads. Any optional cloud features MUST be opt-in and clearly disclosed.
- **C-005**: Data at rest MUST be encrypted (AES-256 recommended) and storage access controlled by the app's secure storage policy.
- **C-005**: Data at rest MUST be encrypted (AES-256 recommended) and storage access controlled by the app's secure storage policy.
- **C-006**: STT and TTS processing MUST be performed on-device (local-only); audio and transcriptions MUST NOT be sent to external services by default.
- **C-005**: Data at rest MUST be encrypted (AES-256 recommended) and storage access controlled by the app's secure storage policy.
- **C-006**: STT and TTS processing MUST be performed on-device (local-only); audio and transcriptions MUST NOT be sent to external services by default.
- **C-007**: App v1 MUST only accept developer-signed model artifacts. The installation pipeline MUST verify signatures and checksums and refuse unsigned or invalid artifacts. Sideloading unsigned models is prohibited in v1.
- **C-008**: Key management requirements: use the platform secure keystore (Secure Enclave / Android Keystore) by default (non-exportable). Allow optional user-passphrase-protected export with a strong KDF and authenticated encryption. Cloud KMS usage is disallowed by default and must be an explicit opt-in with clear consent and documentation.

## Open Questions

None.

---

**Spec ready for planning.**
