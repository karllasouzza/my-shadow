/**
 * History Store & View-Model
 *
 * Padrão synced() com persistência automática via MMKV.
 */

import type {
    ChatConversation,
    ChatConversationIndex,
} from "@/features/chat/model/chat-conversation";
import * as ChatService from "@/features/chat/service/chat-service";
import { Result } from "@/shared/utils/app-error";
import { observable } from "@legendapp/state";
import { ObservablePersistMMKV } from "@legendapp/state/persist-plugins/mmkv";
import { synced } from "@legendapp/state/sync";

// ============================================================================
// Tipos
// ============================================================================

interface HistoryState {
  conversations: ChatConversationIndex[];
  isLoading: boolean;
  errorMessage: string | null;
}

const INITIAL_STATE: HistoryState = {
  conversations: [],
  isLoading: false,
  errorMessage: null,
};

// ============================================================================
// Store com synced() — persistência automática
// ============================================================================

export const historyStore$ = observable(
  synced<HistoryState>({
    initial: INITIAL_STATE,
    persist: {
      name: "history_state",
      plugin: new ObservablePersistMMKV({ id: "myAppStorage" }),
    },
  }),
);

// ============================================================================
// Actions
// ============================================================================

/** Carrega lista de conversas do MMKV */
export async function loadConversations(): Promise<
  Result<ChatConversationIndex[]>
> {
  historyStore$.isLoading.set(true);
  historyStore$.errorMessage.set(null);

  const result = ChatService.listConversations();
  if (result.success) {
    historyStore$.conversations.set(result.data);
  } else {
    historyStore$.errorMessage.set(result.error.message);
  }

  historyStore$.isLoading.set(false);
  return result;
}

/** Carrega conversa completa e retorna */
export async function loadFullConversation(
  id: string,
): Promise<Result<ChatConversation | null>> {
  return ChatService.loadConversation(id);
}

/** Deleta conversa e atualiza lista */
export async function deleteConversation(id: string): Promise<Result<void>> {
  const result = ChatService.deleteConversation(id);
  if (result.success) {
    await loadConversations();
  }
  return result;
}

/** Renomeia conversa e atualiza lista */
export async function renameConversationFn(
  id: string,
  newTitle: string,
): Promise<Result<ChatConversation | null>> {
  const result = ChatService.renameConversation(id, newTitle);
  if (result.success) {
    await loadConversations();
  }
  return result;
}

// ============================================================================
// Helpers
// ============================================================================

export function getConversations() {
  return historyStore$.conversations.get();
}

export function getHistoryIsLoading() {
  return historyStore$.isLoading.get();
}

export function getHistoryErrorMessage() {
  return historyStore$.errorMessage.get();
}
