import { getStorage } from "..";

const LAST_MODEL_KEY = "chat:last_model";

function getStore() {
  return getStorage();
}

export function getLastUsedModelId(): string | null {
  const store = getStore();
  try {
    if (!store) return null;

    return store.getString(LAST_MODEL_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setLastUsedModelId(id: string): boolean {
  if (!id) return false;

  const store = getStore();
  if (!store) return false;

  const current = store.getString(LAST_MODEL_KEY);
  if (current === id) return true;

  store.set(LAST_MODEL_KEY, id);

  const verify = store.getString(LAST_MODEL_KEY);
  if (verify !== id) {
    console.error("Failed to set last used model ID");
    return false;
  }

  return true;
}
