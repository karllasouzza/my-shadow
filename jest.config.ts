import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "react-native",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  testMatch: [
    "**/tests/**/*.spec.(ts|tsx|js)",
    "**/tests/**/*.test.(ts|tsx|js)",
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|@rn-primitives)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};

export default config;
