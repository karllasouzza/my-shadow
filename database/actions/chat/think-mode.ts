import { getStorage } from "../../chat";

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
