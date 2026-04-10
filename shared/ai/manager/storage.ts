import { type MMKV, createMMKV } from "react-native-mmkv";
import { ACTIVE_MODEL_KEY, DOWNLOADED_MODELS_KEY } from "./constants";

export type DownloadedModelMap = Record<string, string>;

let mmkvInstance: MMKV | null = null;

function getMMKV(): MMKV {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: "model_config" });
  }

  return mmkvInstance;
}

function parseMap(rawValue: string | undefined): DownloadedModelMap {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const entries = Object.entries(parsed).filter((entry) => {
      const [key, value] = entry;
      return (
        typeof key === "string" && key.length > 0 && typeof value === "string"
      );
    });

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function writeMap(map: DownloadedModelMap): void {
  const store = getMMKV();
  store.set(DOWNLOADED_MODELS_KEY, JSON.stringify(map));
}

export function setActiveModelId(modelId: string): void {
  const store = getMMKV();
  store.set(ACTIVE_MODEL_KEY, modelId);
}

export function clearActiveModelId(): void {
  const store = getMMKV();
  store.remove(ACTIVE_MODEL_KEY);
}

export function getActiveModelId(): string | null {
  const store = getMMKV();
  return store.getString(ACTIVE_MODEL_KEY) ?? null;
}

export function getDownloadedModelMap(): DownloadedModelMap {
  const store = getMMKV();
  const raw = store.getString(DOWNLOADED_MODELS_KEY);
  return parseMap(raw);
}

export function replaceDownloadedModelMap(map: DownloadedModelMap): void {
  writeMap(map);
}

export function setDownloadedModelPath(modelId: string, localPath: string): void {
  const map = getDownloadedModelMap();
  map[modelId] = localPath;
  writeMap(map);
}

export function removeDownloadedModelKey(key: string): void {
  const map = getDownloadedModelMap();
  if (key in map) {
    delete map[key];
    writeMap(map);
  }
}
