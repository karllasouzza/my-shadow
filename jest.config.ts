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
    "node_modules/(?!(react-native|@react-native|@react-navigation|@rn-primitives|expo-file-system)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^llama\\.rn$": "<rootDir>/tests/__mocks__/llama.rn.ts",
    "^expo-file-system/legacy$":
      "<rootDir>/tests/__mocks__/expo-file-system.ts",
    "^@react-native-rag/op-sqlite$":
      "<rootDir>/tests/__mocks__/react-native-rag-op-sqlite.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
};

export default config;
