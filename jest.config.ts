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
  moduleNameMapper: {
    "^llama\\.rn$": "<rootDir>/tests/__mocks__/llama.rn.ts",
    "^react-native-executorch$":
      "<rootDir>/tests/__mocks__/react-native-executorch.ts",
    "^@react-native-rag/executorch$":
      "<rootDir>/tests/__mocks__/react-native-rag-executorch.ts",
    "^@react-native-rag/op-sqlite$":
      "<rootDir>/tests/__mocks__/react-native-rag-op-sqlite.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
};

export default config;
