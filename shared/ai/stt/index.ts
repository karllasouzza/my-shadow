/**
 * Speech-to-Text (STT) module
 *
 * Provides on-device speech-to-text transcription using Whisper models.
 */

export {
    WHISPER_CATALOG,
    findWhisperModelById,
    getAllWhisperModels
} from "./catalog";
export {
    isRealtimeTranscriptionActive, startRealtimeTranscription,
    stopRealtimeTranscription
} from "./realtime";
export type { RealtimeOptions } from "./realtime";
export { WhisperRuntime, getWhisperRuntime } from "./runtime";
export { transcribe } from "./transcribe";
export type { TranscribeOptions } from "./transcribe";
export type {
    SpeechSegment,
    TranscriptionResult,
    TranscriptionSegment,
    WhisperModel
} from "./types";

