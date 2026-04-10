/**
 * T048: History view-model using Legend State observables
 *
 * Manages history screen state: conversation list, loading state.
 */
import {
    ChatConversation,
    ChatConversationIndex,
} from "@/features/chat/model/chat-conversation";
import * as ChatService from "@/features/chat/service/chat-service";
import { Result } from "@/shared/utils/app-error";
import { observable, Observable } from "@legendapp/state";

export interface HistoryState {
  /** List of conversations for display */
  conversations: Observable<ChatConversationIndex[]>;
  /** Whether data is being loaded */
  isLoading: Observable<boolean>;
  /** Error message if any */
  errorMessage: Observable<string | null>;
}

let historyState: HistoryState | null = null;

export function getHistoryState(): HistoryState {
  if (!historyState) {
    historyState = {
      conversations: observable<ChatConversationIndex[]>([]),
      isLoading: observable(false),
      errorMessage: observable<string | null>(null),
    };
  }
  return historyState;
}

/** Load conversation index from storage */
export async function loadConversations(): Promise<
  Result<ChatConversationIndex[]>
> {
  const state = getHistoryState();
  state.isLoading.set(true);
  state.errorMessage.set(null);

  const result = ChatService.listConversations();
  if (result.success) {
    state.conversations.set(result.data);
  } else {
    state.errorMessage.set(result.error.message);
  }

  state.isLoading.set(false);
  return result;
}

/** Load full conversation and return it */
export async function loadFullConversation(
  id: string,
): Promise<Result<ChatConversation | null>> {
  return ChatService.loadConversation(id);
}

/** Delete a conversation */
export async function deleteConversation(id: string): Promise<Result<void>> {
  const result = ChatService.deleteConversation(id);
  if (result.success) {
    // Refresh list
    await loadConversations();
  }
  return result;
}

/** Rename a conversation */
export async function renameConversation(
  id: string,
  newTitle: string,
): Promise<Result<ChatConversation | null>> {
  const result = ChatService.renameConversation(id, newTitle);
  if (result.success) {
    await loadConversations();
  }
  return result;
}
