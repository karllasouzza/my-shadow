export interface WhisperModel {
  id: string;
  displayName: string;
  description: string;
  downloadLink: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  modelType: "bin";
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SpeechSegment {
  startMs: number;
  endMs: number;
}
