/**
 * Database: Chat Actions
 *
 * Ações de estado que precisam de persistência (MMKV).
 * Getters/setters para estado volátil que sobrevive a sessões.
 */

import { getStorage } from "@/database/chat";

// ============================================================================
// Thinking Toggle — persistido globalmente
// ============================================================================

const THINKING_KEY = "chat:thinking_enabled";

export function getThinkingEnabled(): boolean {
  try {
    const store = getStorage();
    const raw = store.getString(THINKING_KEY);
    return raw === "true";
  } catch {
    return true;
  }
}

export function setThinkingEnabled(enabled: boolean): void {
  try {
    const store = getStorage();
    store.set(THINKING_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore
  }
}

// ============================================================================
// Last Active Conversation — persistido para restaurar sessão
// ============================================================================

const LAST_CONV_KEY = "chat:last_conversation";

export function getLastConversationId(): string | null {
  try {
    const store = getStorage();
    return store.getString(LAST_CONV_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setLastConversationId(id: string | null): void {
  try {
    const store = getStorage();
    if (id) {
      store.set(LAST_CONV_KEY, id);
    } else {
      store.remove(LAST_CONV_KEY);
    }
  } catch {
    // Ignore
  }
}
