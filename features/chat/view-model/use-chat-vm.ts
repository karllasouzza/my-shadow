/**
 * T023/T024/T025/T033: Chat view-model
 *
 * Legend State observables for chat screen:
 * - currentConversation, isModelReady, isGenerating, streamingText,
 *   errorMessage, showCancelOption
 *
 * Actions: sendMessage(), cancelGeneration(), syncModelStatus(), resetChatState(),
 *          loadConversation()
 */
import type { ChatConversation } from "@/features/chat/model/chat-conversation";
import { validateChatMessage } from "@/features/chat/model/chat-message";
import * as ChatService from "@/features/chat/service/chat-service";
import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { observable, Observable } from "@legendapp/state";

export interface ChatState {
  currentConversation: Observable<ChatConversation | null>;
  isModelReady: Observable<boolean>;
  isGenerating: Observable<boolean>;
  streamingText: Observable<string>;
  errorMessage: Observable<string | null>;
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
      showCancelOption: observable(false),
    };
  }
  return chatState;
}

/** Check if runtime has a model loaded and update state */
export async function syncModelStatus(): Promise<void> {
  const runtime = getLocalAIRuntime();
  console.log(runtime);
  const loaded = runtime.isModelLoaded();
  console.log("Model loaded:", loaded);
  const state = getChatState();
  console.log("Updating state.isModelReady to", loaded);
  state.isModelReady.set(loaded);
}

/**
 * T024/T025: Send user message → stream AI response via onToken
 *
 * Validates message, checks model readiness, appends user message,
 * calls generateCompletion with onToken for progressive display,
 * then appends assistant response.
 */
export async function sendMessage(content: string): Promise<void> {
  const state = getChatState();
  state.errorMessage.set(null);

  // T025: Validate message
  const validation = validateChatMessage(content);
  if (!validation.isValid) {
    state.errorMessage.set(validation.error ?? "Mensagem inválida.");
    return;
  }

  // Check model readiness
  if (!state.isModelReady.get()) {
    state.errorMessage.set(
      "Nenhum modelo carregado. Vá para Modelos para carregar um.",
    );
    return;
  }

  // Get or create conversation
  let conv = state.currentConversation.get();
  if (!conv) {
    const newConv = ChatService.createConversation("unknown");
    conv = newConv;
    state.currentConversation.set(conv);
  }

  // T031: Append user message
  const userMsgResult = ChatService.appendUserMessage(conv.id, content);
  if (!userMsgResult.success) {
    state.errorMessage.set("Falha ao salvar mensagem.");
    return;
  }
  const updatedConv = userMsgResult.data;
  if (!updatedConv) return;

  // Update observable
  state.currentConversation.set(updatedConv);
  state.streamingText.set("");
  state.isGenerating.set(true);
  state.showCancelOption.set(false);

  // T033: Prepare cancel token + 30s timeout for cancel option
  cancelToken = { cancelled: false };
  generationTimeout = setTimeout(() => {
    state.showCancelOption.set(true);
  }, 30_000);

  // T024: Call generateCompletion with onToken streaming
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

  // T031: Save assistant response
  const assistantText = completionResult.data.text;
  const saveResult = ChatService.appendAssistantMessage(conv.id, assistantText);
  if (saveResult.success && saveResult.data) {
    state.currentConversation.set(saveResult.data);
  }
  state.streamingText.set("");
}

/** T033: Cancel ongoing generation */
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
