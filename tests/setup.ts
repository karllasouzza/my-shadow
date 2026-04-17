/**
 * Bun test preload: mocks native modules before any test imports.
 * Must be loaded via bunfig.toml [test] preload to work properly.
 */

// Mock react-native
const rnMock = {
  Platform: {
    OS: "android" as const,
    select: (m: Record<string, unknown>) => m.android ?? m.default,
  },
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
    currentState: "active",
  },
  NativeModules: {},
};

// Mock react-native-device-info
const deviceInfoMock = {
  default: {
    getTotalMemory: () => Promise.resolve(4 * 1024 * 1024 * 1024),
    getUsedMemory: () => Promise.resolve(2.2 * 1024 * 1024 * 1024),
    getMaxMemory: () => Promise.resolve(8),
    getNumberOfCores: () => Promise.resolve(8),
    getBrand: () => Promise.resolve("Qualcomm"),
    getSystemVersion: () => Promise.resolve("12.0"),
    getModel: () => Promise.resolve("Pixel 4a"),
    getUniqueId: () => Promise.resolve("test-device-id"),
    getDeviceName: () => Promise.resolve("Test Device"),
    isTablet: () => false,
  },
};

// @ts-expect-error — global mock injection for bun test environment
globalThis.__RN_MOCK__ = rnMock;
// @ts-expect-error — global mock injection for bun test environment
globalThis.__DEVICE_INFO_MOCK__ = deviceInfoMock;

// Initialize a shared in-memory store map for MMKV mocks used in tests
// @ts-expect-error — test global
globalThis.__MMKV_STORES__ = new Map<string, Map<string, string>>();

// Mock react-native-mmkv using the shared stores map so tests can inspect persisted data
if (typeof Bun !== "undefined" && (Bun as any).mock) {
  (Bun as any).mock.module("react-native-mmkv", () => ({
    createMMKV: ({ id }: { id: string }) => {
      const stores = (globalThis as any).__MMKV_STORES__ as Map<
        string,
        Map<string, string>
      >;
      if (!stores.has(id)) stores.set(id, new Map());
      const state = stores.get(id)!;
      return {
        set: (key: string, value: string) => state.set(key, value),
        getString: (key: string) => state.get(key),
        getAllKeys: () => [...state.keys()],
      };
    },
  }));

  (Bun as any).mock.module("expo-crypto", () => ({
    randomUUID: () => "mocked-conversation-id",
  }));
}

declare global {
  const Bun: {
    mock: {
      module: (path: string, factory: () => unknown) => void;
    };
  };
}

if (typeof Bun !== "undefined" && Bun.mock) {
  Bun.mock.module("react-native", () => rnMock);
  Bun.mock.module("react-native-device-info", () => deviceInfoMock);
}
