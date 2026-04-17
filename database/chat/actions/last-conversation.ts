import { getStorage } from "@/database/chat";

const LAST_CONV_KEY = "chat:last_conversation";

export function getLastConversationId(): string | null {
  try {
    const store = getStorage();
    return store.getString(LAST_CONV_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setLastConversationId(id: string): boolean {
  if (!id) return false;

  const store = getStorage();
  if (!store) return false;

  store.set(LAST_CONV_KEY, id);

  const verify = store.getString(LAST_CONV_KEY);
  if (verify !== id) {
    console.error("Failed to set last conversation ID");
    return false;
  }

  return true;
}
