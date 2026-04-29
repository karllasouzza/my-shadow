import type { NativeCompletionResultTimings, ToolCall } from "llama.rn";

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
  /** Tool call ID (for role: "tool" messages linking to the tool call) */
  tool_call_id?: string;
  /** Tool calls made by the assistant (for role: "assistant" messages) */
  tool_calls?: ToolCall[];
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
