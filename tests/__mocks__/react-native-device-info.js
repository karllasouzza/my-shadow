// Manual mock for react-native-device-info in bun test environment
const FOUR_GB = 4 * 1024 * 1024 * 1024;
const TWO_GB = 2 * 1024 * 1024 * 1024;

const mock = {
  getTotalMemory: () => Promise.resolve(FOUR_GB),
  getUsedMemory: () => Promise.resolve(TWO_GB),
  getMaxMemory: () => Promise.resolve(8),
  getBrand: () => Promise.resolve("Qualcomm"),
  getSystemVersion: () => Promise.resolve("12.0"),
  getModel: () => Promise.resolve("Pixel 4a"),
  getUniqueId: () => Promise.resolve("test-device-id"),
  getDeviceName: () => Promise.resolve("Test Device"),
  isTablet: () => false,
};

module.exports = { default: mock, ...mock };
