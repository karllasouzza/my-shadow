module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react-native$": "<rootDir>/tests/__mocks__/react-native.js",
    "^react-native-device-info$":
      "<rootDir>/tests/__mocks__/react-native-device-info.js",
  },
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
};
