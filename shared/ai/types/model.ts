import { ModelType } from "./manager";

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
  bytes?: string; // LLM only
  description: string;
  huggingFaceId?: string; // LLM only
  downloadLink: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  tags?: string[];
  supportsReasoning?: boolean; // LLM only
  modelType: ModelType; // discriminator
}
