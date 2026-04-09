/**
 * T021/T022/T023: Chat view-model with full sendMessage, streaming, cancel
 *
 * Manages chat screen state: messages, model readiness, generation status.
 * Wires sendMessage() to local-ai-runtime.generateCompletion() with onToken.
 */
import {
    ChatConversation
} from "@/features/chat/model/chat-conversation";
import { validateChatMessage } from "@/features/chat/model/chat-message";
import * as ChatService from "@/features/chat/service/chat-service";
import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { observable, Observable } from "@legendapp/state";

export interface ChatState {
  /** Current conversation being displayed */
  currentConversation: Observable<ChatConversation | null>;
  /** Whether a model is loaded and ready for generation */
  isModelReady: Observable<boolean>;
  /** Whether AI is currently generating a response */
  isGenerating: Observable<boolean>;
  /** Currently streaming tokens (appended to pending assistant message) */
  streamingText: Observable<string>;
  /** Error message if any */
  errorMessage: Observable<string | null>;
  /** Loaded model name for display */
  loadedModelName: Observable<string | null>;
  /** Whether to show cancel button (after 30s of generation) */
  showCancelOption: Observable<boolean>;
}

let chatState: ChatState | null = null;
let cancelToken: { cancelled: boolean } | null = null;
let generationTimeout: ReturnType<typeof setTimeout> | null = null;

export function getChatState(): ChatState {
  if (!chatState) {
    chatState = {
      currentConversation: observable<ChatConversation | null>(null),
      isModelReady: observable(false),
      isGenerating: observable(false),
      streamingText: observable(""),
      errorMessage: observable<string | null>(null),
      loadedModelName: observable<string | null>(null),
      showCancelOption: observable(false),
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

/** Send a user message and stream the AI response */
export async function sendMessage(content: string): Promise<void> {
  const state = getChatState();
  state.errorMessage.set(null);

  // Validate message
  const validation = validateChatMessage(content);
  if (!validation.isValid) {
    state.errorMessage.set(validation.error ?? "Invalid message");
    return;
  }

  // Check model readiness
  if (!state.isModelReady.get()) {
    state.errorMessage.set(
      "Nenhum modelo carregado. Selecione um modelo primeiro.",
    );
    return;
  }

  // Get or create conversation
  let conv = state.currentConversation.get();
  if (!conv) {
    const newConv = ChatService.createConversation(
      state.loadedModelName.get() ?? "unknown",
    );
    conv = newConv;
    state.currentConversation.set(conv);
  }

  // Append user message
  const userMsgResult = ChatService.appendUserMessage(conv.id, content);
  if (!userMsgResult.success) {
    state.errorMessage.set("Falha ao salvar mensagem.");
    return;
  }
  const updatedConv = userMsgResult.data;
  if (!updatedConv) return;

  // Update observable with user message
  state.currentConversation.set(updatedConv);
  state.streamingText.set("");
  state.isGenerating.set(true);
  state.showCancelOption.set(false);

  // Prepare for streaming
  cancelToken = { cancelled: false };

  // Show cancel option after 30 seconds (PF-005)
  generationTimeout = setTimeout(() => {
    state.showCancelOption.set(true);
  }, 30_000);

  // Build messages array for generateCompletion
  const messages = updatedConv.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const runtime = getLocalAIRuntime();
  const completionResult = await runtime.generateCompletion(messages, {
    onToken: (token: string) => {
      if (cancelToken?.cancelled) return;
      state.streamingText.set((prev: string) => prev + token);
    },
  });

  // Clear timeout
  if (generationTimeout) {
    clearTimeout(generationTimeout);
    generationTimeout = null;
  }

  state.isGenerating.set(false);
  state.showCancelOption.set(false);

  if (!completionResult.success) {
    state.errorMessage.set(completionResult.error.message);
    return;
  }

  // Cancel was triggered
  if (cancelToken?.cancelled) {
    const partialText = state.streamingText.get();
    if (partialText.trim()) {
      ChatService.appendAssistantMessage(
        conv!.id,
        partialText + " [cancelado]",
      );
    }
    state.streamingText.set("");
    return;
  }

  // Save assistant response
  const assistantText = completionResult.data.text;
  const saveResult = ChatService.appendAssistantMessage(conv.id, assistantText);
  if (saveResult.success && saveResult.data) {
    state.currentConversation.set(saveResult.data);
  }
  state.streamingText.set("");
}

/** Cancel ongoing generation */
export function cancelGeneration(): void {
  if (cancelToken) {
    cancelToken.cancelled = true;
  }
  if (generationTimeout) {
    clearTimeout(generationTimeout);
    generationTimeout = null;
  }
  const state = getChatState();
  state.isGenerating.set(false);
  state.showCancelOption.set(false);
}

/** Load an existing conversation by ID */
export async function loadConversation(id: string): Promise<void> {
  const result = ChatService.loadConversation(id);
  if (result.success) {
    getChatState().currentConversation.set(result.data);
  }
}

/** Start a brand new conversation */
export function newConversation(): void {
  resetChatState();
}

/** Reset chat state for new conversation */
export function resetChatState(): void {
  if (generationTimeout) {
    clearTimeout(generationTimeout);
    generationTimeout = null;
  }
  cancelToken = null;
  const state = getChatState();
  state.currentConversation.set(null);
  state.isGenerating.set(false);
  state.streamingText.set("");
  state.errorMessage.set(null);
  state.showCancelOption.set(false);
}
