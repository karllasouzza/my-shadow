import { ModelType } from "./manager";

export interface ModelLoadResult {
  success: boolean;
  error?: string;
}

export interface AvailableModel {
  id: string;
  displayName: string;
  bytes: string;
  isLoaded: boolean;
  supportsReasoning: boolean;
  modelType: ModelType;
}
