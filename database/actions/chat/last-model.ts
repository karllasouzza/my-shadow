import { getStorage } from "../../chat";

const LAST_MODEL_KEY = "chat:last_model";

export function getLastUsedModelId(): string | null {
  try {
    const store = getStorage();
    if (!store) return null;

    return store.getString(LAST_MODEL_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setLastUsedModelId(id: string): boolean {
  if (!id) return false;

  const store = getStorage();
  if (!store) return false;

  store.set(LAST_MODEL_KEY, id);

  const verify = store.getString(LAST_MODEL_KEY);
  if (verify !== id) {
    console.error("Failed to set last used model ID");
    return false;
  }

  return true;
}
