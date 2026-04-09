/**
 * T017/T021: Chat view-model using Legend State observables
 *
 * Manages chat screen state: messages, model readiness, generation status.
 * Foundation skeleton — full sendMessage wiring in Phase 3 (US1).
 */
import { ChatConversation } from "@/features/chat/model/chat-conversation";
import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { observable, Observable } from "@legendapp/state";

export interface ChatState {
  /** Current conversation being displayed */
  currentConversation: Observable<ChatConversation | null>;
  /** Whether a model is loaded and ready for generation */
  isModelReady: Observable<boolean>;
  /** Whether AI is currently generating a response */
  isGenerating: Observable<boolean>;
  /** Currently streaming tokens (not yet committed to conversation) */
  streamingText: Observable<string>;
  /** Error message if any */
  errorMessage: Observable<string | null>;
  /** Loaded model name for display */
  loadedModelName: Observable<string | null>;
}

let chatState: ChatState | null = null;

export function getChatState(): ChatState {
  if (!chatState) {
    chatState = {
      currentConversation: observable<ChatConversation | null>(null),
      isModelReady: observable(false),
      isGenerating: observable(false),
      streamingText: observable(""),
      errorMessage: observable<string | null>(null),
      loadedModelName: observable<string | null>(null),
    };
  }
  return chatState;
}

/** Check if runtime has a model loaded and update state */
export async function syncModelStatus(): Promise<void> {
  const runtime = getLocalAIRuntime();
  const loaded = runtime.isModelLoaded();
  const model = runtime.getCurrentModel();
  const state = getChatState();
  state.isModelReady.set(loaded);
  state.loadedModelName.set(model?.name ?? null);
}

/** Reset chat state for new conversation */
export function resetChatState(): void {
  const state = getChatState();
  state.currentConversation.set(null);
  state.isGenerating.set(false);
  state.streamingText.set("");
  state.errorMessage.set(null);
}
