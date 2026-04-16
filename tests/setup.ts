/**
 * Bun test preload: mocks native modules before any test imports.
 * Must be loaded via bunfig.toml [test] preload to work properly.
 */

// Mock react-native
const rnMock = {
  Platform: { OS: "android" as const, select: (m: Record<string, unknown>) => m.android ?? m.default },
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
