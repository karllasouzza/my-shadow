export interface ModelLoadResult {
  success: boolean;
  error?: string;
}

export interface AvailableModel {
  id: string;
  displayName: string;
  isLoaded: boolean;
  supportsReasoning: boolean;
}
