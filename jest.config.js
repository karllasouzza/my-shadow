module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
};
