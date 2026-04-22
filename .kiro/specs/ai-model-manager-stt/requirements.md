# Requirements Document

## Introduction

This feature refactors `shared/ai/manager.ts` and `shared/ai/model-loader.ts` into a unified global model manager that supports multiple model types (GGUF for LLM inference and `.bin` for Whisper/STT) and concurrent downloads. It also introduces a new `shared/ai/stt/` module powered by `whisper.rn`, providing transcription, Voice Activity Detection (VAD), and real-time transcription capabilities.

## Glossary

- **Model_Manager**: The unified module responsible for downloading, storing, caching, and tracking all model types (GGUF and Whisper `.bin`).
- **Model_Loader**: The module responsible for loading and unloading models into their respective runtimes (LLM or Whisper).
- **LLM_Runtime**: The singleton `AIRuntime` instance that runs GGUF models via `llama.rn`.
- **Whisper_Runtime**: The singleton that runs Whisper `.bin` models via `whisper.rn`.
- **STT_Module**: The `shared/ai/stt/` folder containing Transcribe, VAD, and Realtime Transcription sub-modules.
- **Transcriber**: The sub-module inside `shared/ai/stt/` that transcribes a complete audio file or buffer.
- **VAD**: Voice Activity Detection — the sub-module that detects speech segments within an audio stream. Implemented using `whisper.rn`'s native built-in VAD capabilities (no separate VAD library).
- **Realtime_Transcriber**: The sub-module that transcribes audio in real time from a microphone stream using `expo-audio` for capture.
- **Model_Catalog**: The registry of all downloadable models (both LLM and Whisper).
- **Result**: The `Result<T>` / `ok` / `err` typed error-handling pattern already used throughout the codebase.
- **Download_Task**: An in-flight download operation tracked by the Model_Manager, identified by `modelId`.
- **Model_Type**: An enum discriminating between `"gguf"` (LLM) and `"bin"` (Whisper/STT) model formats.

---

## Requirements

### Requirement 1: Unified Model Manager — Multi-Type Storage

**User Story:** As a developer, I want the Model_Manager to handle both GGUF and `.bin` model files, so that I can store and retrieve any model type through a single API.

#### Acceptance Criteria

1. THE Model_Manager SHALL store GGUF models at `{documentDirectory}models/{modelId}.gguf`.
2. THE Model_Manager SHALL store Whisper `.bin` models at `{documentDirectory}models/{modelId}.bin`.
3. WHEN `getDownloadedModels()` is called, THE Model_Manager SHALL return a map of all downloaded models regardless of Model_Type, including each model's local file path and Model_Type.
4. WHEN `getModelLocalPath(modelId)` is called, THE Model_Manager SHALL return the correct local path for the given `modelId` regardless of Model_Type.
5. WHEN `isModelDownloaded(modelId)` is called, THE Model_Manager SHALL return `true` if and only if the model file exists on disk.
6. THE Model_Manager SHALL maintain a short-lived in-memory cache (TTL ≤ 10 seconds) for the downloaded models list to avoid redundant disk reads.
7. WHEN `invalidateDownloadedModelsCache()` is called, THE Model_Manager SHALL clear the in-memory cache immediately.

---

### Requirement 2: Unified Model Manager — Concurrent Downloads

**User Story:** As a developer, I want to download multiple models simultaneously, so that users can queue and fetch several models without waiting for each to finish sequentially.

#### Acceptance Criteria

1. WHEN `downloadModelById(modelId, link, onProgress?)` is called for multiple distinct `modelId` values concurrently, THE Model_Manager SHALL execute all downloads in parallel without blocking one another.
2. WHEN `downloadModelById` is called for a `modelId` that is already being downloaded, THE Model_Manager SHALL return the existing Download_Task's promise rather than starting a duplicate download.
3. WHEN a download completes successfully, THE Model_Manager SHALL update the in-memory cache and invoke `onProgress` with `progress: 100`.
4. IF a download fails, THEN THE Model_Manager SHALL remove any partial file from disk and return an `err(Result)` with a descriptive error message.
5. WHEN `cancelDownload(modelId)` is called, THE Model_Manager SHALL abort the in-flight download for that `modelId` and remove any partial file from disk.
6. THE Model_Manager SHALL expose a `getDownloadProgress(modelId)` function that returns the current download progress (0–100) for an active Download_Task, or `null` if no download is in progress for that `modelId`.

---

### Requirement 3: Unified Model Manager — Model Removal

**User Story:** As a developer, I want to remove any downloaded model by ID, so that users can free up device storage.

#### Acceptance Criteria

1. WHEN `removeDownloadedModel(modelId)` is called and the model is currently loaded in the LLM_Runtime or Whisper_Runtime, THE Model_Manager SHALL unload the model from its runtime before deleting the file.
2. WHEN `removeDownloadedModel(modelId)` is called and the model file exists on disk, THE Model_Manager SHALL delete the file and update the in-memory cache.
3. IF the model file does not exist when `removeDownloadedModel(modelId)` is called, THEN THE Model_Manager SHALL return `ok(undefined)` without error.
4. IF file deletion fails, THEN THE Model_Manager SHALL return an `err(Result)` with a `STORAGE_ERROR` code.

---

### Requirement 4: Unified Model Loader — Multi-Runtime Dispatch

**User Story:** As a developer, I want a single `loadModel(modelId)` entry point that dispatches to the correct runtime based on Model_Type, so that callers do not need to know which runtime handles a given model.

#### Acceptance Criteria

1. WHEN `loadModel(modelId)` is called for a GGUF model, THE Model_Loader SHALL load the model into the LLM_Runtime.
2. WHEN `loadModel(modelId)` is called for a Whisper `.bin` model, THE Model_Loader SHALL load the model into the Whisper_Runtime.
3. IF `loadModel(modelId)` is called for a `modelId` not present in the Model_Catalog, THEN THE Model_Loader SHALL return `{ success: false, error: "Modelo não encontrado" }`.
4. IF `loadModel(modelId)` is called for a `modelId` that has not been downloaded, THEN THE Model_Loader SHALL return `{ success: false, error: "Modelo não baixado" }`.
5. WHEN a model is successfully loaded, THE Model_Loader SHALL persist the `modelId` to `chatState$.lastModelId` for LLM models and to a dedicated `chatState$.lastWhisperModelId` observable for Whisper models.
6. WHEN `unloadModel(modelId)` is called, THE Model_Loader SHALL unload the model from its corresponding runtime and clear the relevant persisted state.
7. WHEN `getAvailableModels()` is called, THE Model_Loader SHALL return all downloaded models annotated with their Model_Type and `isLoaded` status.
8. THE Model_Loader SHALL return all user-facing error messages in Brazilian Portuguese (e.g. "Modelo não encontrado", "Modelo não baixado", "Permissão negada").

---

### Requirement 5: Whisper Model Catalog

**User Story:** As a developer, I want a catalog of downloadable Whisper models, so that users can choose an appropriate STT model for their device.

#### Acceptance Criteria

1. THE Model_Catalog SHALL include the following three Whisper `.bin` model entries, each with `id`, `displayName`, `description`, `downloadLink`, `fileSizeBytes`, `estimatedRamBytes`, and `modelType: "bin"` fields:
   - `{ id: "whisper-tiny-pt", displayName: "Whisper Tiny (pt-BR)", description: "Modelo mais leve, ideal para dispositivos com pouca memória.", downloadLink: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin", fileSizeBytes: 77704715, estimatedRamBytes: 125000000, modelType: "bin" }`
   - `{ id: "whisper-base-pt", displayName: "Whisper Base (pt-BR)", description: "Equilíbrio entre velocidade e precisão para português brasileiro.", downloadLink: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin", fileSizeBytes: 147951465, estimatedRamBytes: 210000000, modelType: "bin" }`
   - `{ id: "whisper-small-pt", displayName: "Whisper Small (pt-BR)", description: "Maior precisão para português brasileiro, requer mais memória.", downloadLink: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin", fileSizeBytes: 487601967, estimatedRamBytes: 600000000, modelType: "bin" }`
2. WHEN `findModelById(id)` is called with a Whisper model ID, THE Model_Catalog SHALL return the corresponding Whisper model entry.
3. THE Model_Catalog SHALL expose a `getModelsByType(type: ModelType)` function that returns only models of the specified type.

---

### Requirement 6: Whisper Runtime Singleton

**User Story:** As a developer, I want a `Whisper_Runtime` singleton analogous to `AIRuntime`, so that Whisper model lifecycle (load, unload, transcribe) is managed in one place.

#### Acceptance Criteria

1. THE Whisper_Runtime SHALL expose `loadModel(modelId, path)` that initialises a `whisper.rn` context and returns `Result<{ id: string }>`.
2. THE Whisper_Runtime SHALL expose `unloadModel()` that releases the `whisper.rn` context and returns `Result<void>`.
3. THE Whisper_Runtime SHALL expose `isModelLoaded(id?)` that returns `true` when a context is active (and optionally matches the given `id`).
4. WHEN `loadModel` is called while another load is already in progress, THE Whisper_Runtime SHALL queue the new call and wait for the current load to finish before proceeding.
5. IF `loadModel` fails, THEN THE Whisper_Runtime SHALL release any partially initialised context and return an `err(Result)`.
6. THE Whisper_Runtime SHALL be accessible via a `getWhisperRuntime()` singleton factory function.

---

### Requirement 7: Transcriber Module

**User Story:** As a developer, I want a `Transcriber` module that converts a complete audio file or PCM buffer into text, so that I can transcribe recorded audio on-device.

#### Acceptance Criteria

1. WHEN `transcribe(audioPath, options?)` is called with a valid audio file path and a loaded Whisper model, THE Transcriber SHALL return `Result<TranscriptionResult>` containing the full transcription text and detected language.
2. WHEN `transcribe` is called with an `abortSignal` that fires during transcription, THE Transcriber SHALL stop processing and return `err` with code `"ABORTED"`.
3. IF `transcribe` is called when no Whisper model is loaded, THEN THE Transcriber SHALL return `err` with code `"NOT_READY"`.
4. IF the audio file does not exist at the given path, THEN THE Transcriber SHALL return `err` with code `"FILE_NOT_FOUND"`.
5. THE Transcriber SHALL accept an optional `language` hint in `options` to improve accuracy.
6. THE Transcriber SHALL accept an optional `onProgress` callback in `options` that receives a progress value (0–100) during transcription.

---

### Requirement 8: Voice Activity Detection (VAD) Module

**User Story:** As a developer, I want a VAD module that identifies speech segments in an audio stream, so that the app can avoid transcribing silence and reduce processing cost.

#### Acceptance Criteria

1. WHEN `detectSpeechSegments(audioPath, options?)` is called, THE VAD SHALL return `Result<SpeechSegment[]>` where each `SpeechSegment` contains `startMs` and `endMs` timestamps.
2. WHEN no speech is detected in the audio, THE VAD SHALL return `ok([])` (an empty array) rather than an error.
3. THE VAD SHALL accept an optional `silenceThresholdMs` in `options` (default: 300 ms) that controls the minimum silence gap used to split segments.
4. IF `detectSpeechSegments` is called when no Whisper model is loaded, THEN THE VAD SHALL return `err` with code `"NOT_READY"`.
5. THE VAD SHALL expose a `isSpeaking(audioChunk: Float32Array)` function that returns `boolean` for real-time single-chunk classification.
6. THE VAD SHALL be implemented exclusively using `whisper.rn`'s built-in silence/VAD detection capabilities and SHALL NOT depend on any separate VAD library.

---

### Requirement 9: Realtime Transcription Module

**User Story:** As a developer, I want a `Realtime_Transcriber` module that transcribes microphone audio as the user speaks, so that the app can display live captions or accept voice input.

#### Acceptance Criteria

1. WHEN `startRealtimeTranscription(options)` is called, THE Realtime_Transcriber SHALL begin capturing microphone audio using `expo-audio` (<https://docs.expo.dev/versions/latest/sdk/audio/>) and emitting partial transcription results via an `onPartialResult` callback.
2. WHEN `stopRealtimeTranscription()` is called, THE Realtime_Transcriber SHALL stop microphone capture, flush any remaining audio, emit a final result via `onFinalResult`, and release microphone resources.
3. WHILE a realtime session is active, THE Realtime_Transcriber SHALL invoke `onPartialResult` at most once every 500 ms to avoid overwhelming the UI.
4. IF `startRealtimeTranscription` is called while a session is already active, THEN THE Realtime_Transcriber SHALL return `err` with code `"ALREADY_ACTIVE"`.
5. IF microphone permission is not granted, THEN THE Realtime_Transcriber SHALL return `err` with code `"PERMISSION_DENIED"`.
6. IF no Whisper model is loaded when `startRealtimeTranscription` is called, THEN THE Realtime_Transcriber SHALL return `err` with code `"NOT_READY"`.
7. WHEN the device runs out of memory during a realtime session, THE Realtime_Transcriber SHALL stop the session gracefully, emit any buffered text via `onFinalResult`, and return `err` with code `"OUT_OF_MEMORY"`.
8. THE Realtime_Transcriber SHALL use only `expo-audio` for microphone capture and SHALL NOT use `expo-av` or `react-native-audio-record`.

---

### Requirement 10: Parser / Serializer — Transcription Result Round-Trip

**User Story:** As a developer, I want transcription results to be serialisable and deserialisable without data loss, so that results can be persisted to the database and restored correctly.

#### Acceptance Criteria

1. THE Transcriber SHALL produce `TranscriptionResult` objects that are serialisable to JSON via `JSON.stringify`.
2. WHEN a `TranscriptionResult` is serialised to JSON and then deserialised, THE resulting object SHALL be structurally equivalent to the original (round-trip property).
3. FOR ALL valid `TranscriptionResult` objects, `deserialise(serialise(result))` SHALL produce an object equal to `result` (round-trip property).
