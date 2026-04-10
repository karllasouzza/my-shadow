import { RNLlamaOAICompatibleMessage } from "llama.rn";

export type ChatMessage = RNLlamaOAICompatibleMessage;

export interface LlamaModel {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  contextLength: number;
  isLoaded: boolean;
}

export interface LocalAIRuntimeStatus {
  initialized: boolean;
  modelLoaded: boolean;
  currentModel?: LlamaModel;
  availableMemory?: number;
  totalMemory?: number;
  tokensPerSecond?: number;
}

export interface CompletionOutput {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type OnTokenCallback = (token: string) => void;

export interface CompletionOptions {
  onToken?: OnTokenCallback;
  timeoutMs?: number;
  maxTokens?: number;
}
