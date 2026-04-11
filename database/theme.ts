/**
 * Database: Theme Storage
 *
 * MMKV storage para configurações de tema.
 */

import { createMMKV } from "react-native-mmkv";

const themeStorage = createMMKV({ id: "theme_config" });

export const mmkvStorage = {
  getItem: (key: string): string | null => {
    return themeStorage.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    themeStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    themeStorage.remove(key);
  },
};
