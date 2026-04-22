# Implementation Plan: ai-model-manager-stt

## Overview

Refactor the existing AI model manager and loader into a unified multi-type system supporting both GGUF (LLM) and `.bin` (Whisper/STT) models, then introduce the full `shared/ai/stt/` module powered by `whisper.rn`. All new code follows the existing `Result<T>` / `ok` / `err` error-handling pattern and Legend State persistence conventions.

## Tasks

- [x] 1. Extend shared types
  - [x] 1.1 Extend `shared/ai/types/manager.ts` with `ModelType`, `DownloadedModelInfo`
    - Add `export type ModelType = "gguf" | "bin"`
    - Add `export interface DownloadedModelInfo { modelId: string; localPath: string; modelType: ModelType }`
    - Keep existing `DownloadProgressInfo` and `OnDownloadProgress`
    - _Requirements: 1.3, 2.6_

  - [x] 1.2 Extend `shared/ai/types/model-loader.ts` with `modelType` on `AvailableModel`
    - Import `ModelType` from `../types/manager`
    - Add `modelType: ModelType` field to `AvailableModel`
    - _Requirements: 4.7_

  - [x] 1.3 Extend `shared/ai/types/model.ts` with `modelType` discriminator
    - Add `modelType: ModelType` field to the `Model` interface (optional or required — align with catalog usage)
    - _Requirements: 1.1, 1.2_

- [x] 2. Create `shared/ai/stt/types.ts`
  - Define `WhisperModel`, `TranscriptionResult`, `TranscriptionSegment`, `SpeechSegment` interfaces exactly as specified in the design
  - _Requirements: 5.1, 7.1, 8.1, 10.1_

- [x] 3. Create `shared/ai/stt/catalog.ts` — Whisper model catalog
  - [x] 3.1 Implement `WHISPER_CATALOG` array with the three pt-BR entries
    - `whisper-tiny-pt`, `whisper-base-pt`, `whisper-small-pt` with exact `id`, `displayName`, `description`, `downloadLink`, `fileSizeBytes`, `estimatedRamBytes`, `modelType: "bin"` values from requirements
    - _Requirements: 5.1_

  - [x] 3.2 Implement `findWhisperModelById(id)` and `getAllWhisperModels()`
    - _Requirements: 5.2_

  - [x] 3.3 Implement `getModelsByType(type: ModelType)` across the unified catalog
    - Export from `stt/catalog.ts` or a shared catalog helper; must filter by `modelType`
    - _Requirements: 5.3_

- [x] 4. Extend `shared/ai/text-generation/catalog.ts` — add `modelType: "gguf"` to LLM entries
  - Add `modelType: "gguf"` to every entry in `MODEL_CATALOG`
  - Update `getAllModels()` / `findModelById()` return types to reflect the extended `Model` interface
  - _Requirements: 1.1, 4.1_

- [x] 5. Refactor `shared/ai/manager.ts` — multi-type storage and concurrent downloads
  - [x] 5.1 Add `ModelType`-aware URI generation
    - Replace `getModelUri(modelId)` with `getModelUri(modelId, modelType: ModelType)` returning `.gguf` or `.bin` paths
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 Add concurrent download support with `Map<string, DownloadTask>`
    - Introduce `interface DownloadTask { promise: Promise<Result<string>>; progress: number; abortController: AbortController }`
    - On duplicate `downloadModelById` call for same `modelId`, return existing task's promise
    - _Requirements: 2.1, 2.2_

  - [x] 5.3 Update `downloadModelById` signature to accept `modelType: ModelType`
    - Pass `modelType` to `getModelUri`; store progress in the task map; call `onProgress({ modelId, progress: 100 })` on success; delete partial file on failure
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 5.4 Implement `cancelDownload(modelId)` and `getDownloadProgress(modelId)`
    - `cancelDownload`: abort the `AbortController`, delete partial file, remove task from map
    - `getDownloadProgress`: return `task.progress` or `null`
    - _Requirements: 2.5, 2.6_

  - [x] 5.5 Update `getDownloadedModels()` to return `Record<string, DownloadedModelInfo>`
    - Scan for both `.gguf` and `.bin` files; populate `modelType` accordingly; update cache TTL to ≤ 10 s
    - _Requirements: 1.3, 1.6_

  - [x] 5.6 Update `removeDownloadedModel` to unload from both runtimes
    - Check `getAIRuntime()` and `getWhisperRuntime()` before deleting; return `err(STORAGE_ERROR)` on deletion failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.7 Write property test — Property 2: duplicate download deduplication
    - **Property 2: Duplicate download deduplication**
    - Generate a model ID and N (2–10) concurrent calls to `downloadModelById`; assert exactly one `FileSystem.createDownloadResumable` call and all N promises resolve to the same value
    - **Validates: Requirements 2.2**

  - [x] 5.8 Write property test — Property 3: download progress monotonicity
    - **Property 3: Download progress monotonicity**
    - Generate a sequence of `totalBytesWritten` values; assert reported progress is non-decreasing and ends at 100 on success
    - **Validates: Requirements 2.3**

  - [x] 5.9 Write property test — Property 7: cache invalidation consistency
    - **Property 7: Cache invalidation consistency**
    - Generate random sequences of download/remove/invalidate operations on a mocked filesystem; assert `getDownloadedModels()` always reflects true disk state after invalidation
    - **Validates: Requirements 1.6, 1.7**

  - [x] 5.10 Write property test — Property 1: concurrent downloads are independent
    - **Property 1: Concurrent downloads are independent**
    - Generate two distinct model IDs with mock download durations; assert completion of one does not affect progress or outcome of the other
    - **Validates: Requirements 2.1**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Extend `database/chat` state — add `lastWhisperModelId`
  - Add `lastWhisperModelId: string | null` observable to the `IChatState` interface and its initial value
  - _Requirements: 4.5_

- [~] 8. Refactor `shared/ai/model-loader.ts` — multi-runtime dispatch
  - [x] 8.1 Update `loadModel(modelId)` to dispatch by `modelType`
    - Look up `modelId` in unified catalog (LLM + Whisper); if `modelType === "gguf"` delegate to `getAIRuntime().loadModel`; if `modelType === "bin"` delegate to `getWhisperRuntime().loadModel`
    - Persist to `chatState$.lastModelId` (LLM) or `chatState$.lastWhisperModelId` (Whisper)
    - Return `{ success: false, error: "Modelo não encontrado" }` / `"Modelo não baixado"` as appropriate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_

  - [x] 8.2 Update `unloadModel(modelId)` to accept a `modelId` parameter
    - Determine runtime from catalog; unload from correct runtime; clear relevant `chatState$` field
    - _Requirements: 4.6_

  - [x] 8.3 Update `getAvailableModels()` to include `modelType` and cover both runtimes
    - Merge LLM and Whisper catalog entries; annotate each with `modelType` and `isLoaded` from the correct runtime
    - _Requirements: 4.7_

  - [x] 8.4 Update `getSelectedModelId` and `autoLoadLastModel` to accept `modelType`
    - Route to the correct runtime and `chatState$` field based on `modelType`
    - _Requirements: 4.5_

  - [x] 8.5 Write property test — Property 4: model type routing
    - **Property 4: Model type routing**
    - Generate a model ID from the unified catalog; assert `loadModel` calls `getAIRuntime().loadModel` iff `modelType === "gguf"` and `getWhisperRuntime().loadModel` iff `modelType === "bin"`
    - **Validates: Requirements 4.1, 4.2**

  - [x] 8.6 Write unit tests for model-loader guards
    - Test `NOT_FOUND` when `modelId` absent from catalog
    - Test `"Modelo não baixado"` when model not on disk
    - _Requirements: 4.3, 4.4_

- [~] 9. Create `shared/ai/stt/runtime.ts` — WhisperRuntime singleton
  - [x] 9.1 Implement `WhisperRuntime` class
    - `loadModel(modelId, path)`: call `initWhisper({ filePath: path })`; queue concurrent calls behind `loadingPromise`; release partial context on failure; return `Result<{ id: string }>`
    - `unloadModel()`: call `context.release()`; return `Result<void>`
    - `isModelLoaded(id?)`: return `true` when context active (and optionally matches `id`)
    - `getContext()`: return raw `WhisperContext | null`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.2 Export `getWhisperRuntime()` singleton factory
    - _Requirements: 6.6_

- [~] 10. Create `shared/ai/stt/transcribe.ts` — Transcriber
  - [x] 10.1 Implement `transcribe(audioPath, options?)` returning `Result<TranscriptionResult>`
    - Guard: `getWhisperRuntime().isModelLoaded()` → `err("NOT_READY")` if false
    - Guard: `FileSystem.getInfoAsync(audioPath)` → `err("FILE_NOT_FOUND")` if absent
    - Pass `language` hint to `whisper.rn` options
    - Hook `abortSignal` to the `stop()` function returned by `whisperContext.transcribe` → `err("ABORTED")`
    - Wire `onProgress` callback (0–100) during transcription
    - Map `{ result, segments }` from `whisper.rn` to `TranscriptionResult`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 10.2 Write unit tests for transcribe guards
    - Test `NOT_READY` when no model loaded
    - Test `FILE_NOT_FOUND` when audio file absent
    - Test `ABORTED` when `abortSignal` fires during transcription
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 10.3 Write property test — Property 5: transcription result round-trip
    - **Property 5: Transcription result round-trip**
    - Generate arbitrary `TranscriptionResult` objects (random `text`, `language`, `segments`); assert `JSON.parse(JSON.stringify(r))` deep-equals `r`
    - **Validates: Requirements 10.2, 10.3**

- [x] 11. Create `shared/ai/stt/vad.ts` — VAD module
  - [x] 11.1 Implement `detectSpeechSegments(audioPath, options?)` returning `Result<SpeechSegment[]>`
    - Guard: `getWhisperRuntime().isModelLoaded()` → `err("NOT_READY")` if false
    - Use `whisper.rn` built-in VAD options (`no_speech_thold`, `vad_thold`) — no separate VAD library
    - Extract `segments` from transcription result and map to `SpeechSegment[]` with `startMs`/`endMs`
    - Return `ok([])` when no speech detected
    - Respect `silenceThresholdMs` option (default 300 ms)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [x] 11.2 Implement `isSpeaking(audioChunk: Float32Array): boolean`
    - Lightweight energy-threshold check on raw PCM chunk for real-time single-chunk classification
    - _Requirements: 8.5_

  - [x] 11.3 Write unit tests for VAD guards
    - Test `NOT_READY` when no model loaded
    - Test `ok([])` on silent audio input
    - _Requirements: 8.2, 8.4_

  - [x] 11.4 Write property test — Property 6: VAD empty-audio safety
    - **Property 6: VAD empty-audio safety**
    - Generate audio paths that mock a silent audio file; assert result is `ok([])`
    - **Validates: Requirements 8.2**

- [x] 12. Create `shared/ai/stt/realtime.ts` — Realtime Transcriber
  - [x] 12.1 Implement `startRealtimeTranscription(options: RealtimeOptions)` returning `Result<void>`
    - Guard: `isActive` flag → `err("ALREADY_ACTIVE")` if session running
    - Guard: `getWhisperRuntime().isModelLoaded()` → `err("NOT_READY")` if false
    - Guard: `AudioModule.requestRecordingPermissionsAsync()` → `err("PERMISSION_DENIED")` if denied
    - Create `AudioRecorder` at 16 kHz mono; poll on 500 ms interval; feed audio to `whisperContext.transcribe`; emit via `onPartialResult` at most once per 500 ms
    - Handle OOM: stop session gracefully, emit buffered text via `onFinalResult`, return `err("OUT_OF_MEMORY")`
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 12.2 Implement `stopRealtimeTranscription()` returning `Result<void>`
    - Stop recorder, run final transcription pass, emit via `onFinalResult`, release recorder, clear `isActive`
    - _Requirements: 9.2_

  - [x] 12.3 Write unit tests for realtime guards
    - Test `ALREADY_ACTIVE` when session already running
    - Test `PERMISSION_DENIED` when microphone permission not granted
    - Test `NOT_READY` when no Whisper model loaded
    - _Requirements: 9.4, 9.5, 9.6_

  - [x] 12.4 Write property test — Property 8: realtime throttle
    - **Property 8: Realtime throttle**
    - Generate session durations (1–60 s) with a mocked clock; assert `onPartialResult` call count ≤ ⌈duration / 0.5⌉
    - **Validates: Requirements 9.3**

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use **fast-check** with a minimum of 100 iterations each
- Unit tests cover all guard conditions (`NOT_READY`, `FILE_NOT_FOUND`, `ABORTED`, `ALREADY_ACTIVE`, `PERMISSION_DENIED`)
- All user-facing error messages must remain in Brazilian Portuguese
