export type ModelStatus =
  | "not-downloaded"
  | "downloading"
  | "downloaded"
  | "loading"
  | "loaded"
  | "failed";

export interface Model {
  id: string;
  displayName: string;
  bytes: string;
  description: string;
  huggingFaceId: string;
  downloadLink: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  tags: string[];
  supportsReasoning?: boolean;
}
