export interface LoadedModel {
  id: string;
  isLoaded: boolean;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export interface CompletionOutput {
  text: string;
}

export type OnTokenCallback = (token: string) => void;

export interface StreamCompletionOptions {
  onToken?: OnTokenCallback;
  abortSignal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}
