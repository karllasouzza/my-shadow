import type { NativeCompletionResultTimings } from "llama.rn";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoning_content?: string;
  timings?: NativeCompletionResultTimings;
  modelId?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt?: string;
  _isStreaming?: boolean;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastModelUsedId?: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt?: string;
}
