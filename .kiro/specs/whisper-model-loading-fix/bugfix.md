# Bugfix Requirements Document

## Introduction

This bugfix addresses a critical error in the Whisper model loading process within the React Native app. The error "Cannot read property 'getConstants' of null" indicates that the `whisper.rn` native module is not properly initialized when attempting to load the Whisper model. This prevents the voice message chat feature from functioning, as the Speech-to-Text (STT) capability depends on a successfully loaded Whisper model.

The bug occurs specifically when:
- Model ID: `whisper-tiny-pt`
- Platform: Android (tested on POCO device, Android 14)
- Context: During model loading phase after the Qwen3 0.6B LLM model has been successfully loaded

The impact is severe: users cannot use voice input for chat messages, rendering the voice message feature completely non-functional.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app attempts to load the Whisper model (`whisper-tiny-pt`) via `WhisperRuntime.loadModel()` THEN the system throws a TypeError "Cannot read property 'getConstants' of null"

1.2 WHEN the Whisper native module is accessed before proper initialization THEN the system returns null instead of a valid module reference

1.3 WHEN the model loading error occurs THEN the system logs "Falha ao carregar modelo Whisper" but does not provide actionable recovery information

1.4 WHEN the Whisper module fails to initialize THEN subsequent STT operations (transcription, realtime transcription, VAD) fail with cascading errors

### Expected Behavior (Correct)

2.1 WHEN the app attempts to load the Whisper model (`whisper-tiny-pt`) via `WhisperRuntime.loadModel()` THEN the system SHALL successfully initialize the `whisper.rn` native module and load the model without throwing a TypeError

2.2 WHEN the Whisper native module is accessed THEN the system SHALL return a valid, initialized module reference with all required methods (getConstants, initWhisper, etc.)

2.3 WHEN the model loading process encounters an error THEN the system SHALL log a descriptive error message in Brazilian Portuguese that includes the root cause and SHALL return an appropriate error code (e.g., "MODULE_NOT_INITIALIZED", "NATIVE_MODULE_ERROR")

2.4 WHEN the Whisper module is properly initialized THEN subsequent STT operations (transcription, realtime transcription, VAD) SHALL execute successfully

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app loads the Qwen3 0.6B LLM model via `AIRuntime.loadModel()` THEN the system SHALL CONTINUE TO load the LLM model successfully without interference from Whisper module initialization

3.2 WHEN the app downloads Whisper models via `downloadModelById()` THEN the system SHALL CONTINUE TO download and store `.bin` files correctly at `{documentDirectory}models/{modelId}.bin`

3.3 WHEN the app checks if a Whisper model is downloaded via `isModelDownloaded()` THEN the system SHALL CONTINUE TO correctly detect the presence of `.bin` files on disk

3.4 WHEN the app uses other features that do not depend on Whisper (text chat, LLM inference) THEN the system SHALL CONTINUE TO function normally regardless of Whisper module initialization status

3.5 WHEN the Whisper module is successfully loaded on iOS devices THEN the system SHALL CONTINUE TO function correctly on iOS without regression
