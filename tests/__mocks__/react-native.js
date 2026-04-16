// Manual mock for react-native in bun test environment
module.exports = {
  Platform: {
    OS: "android",
    select: (specifics) => specifics.android ?? specifics.default,
  },
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
    removeEventListener: () => {},
    currentState: "active",
  },
  NativeModules: {},
  Alert: { alert: () => {} },
};
