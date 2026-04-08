declare module "expo-secure-store" {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;

  const _default: {
    getItemAsync: typeof getItemAsync;
    setItemAsync: typeof setItemAsync;
    deleteItemAsync: typeof deleteItemAsync;
  };

  export default _default;
}
