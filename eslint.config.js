// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "**/*.min.js",
    ],
  },
  {
    rules: {
      "import/no-unresolved": [
        "error",
        {
          ignore: ["^react-native-edge-to-edge", "^react-native-nitro-modules"],
        },
      ],
    },
  },
]);
