import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  module: "readonly",
  require: "readonly",
  exports: "writable",
  Buffer: "readonly",
};

const jestGlobals = {
  describe: "readonly",
  it: "readonly",
  expect: "readonly",
  test: "readonly",
};

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: { ...nodeGlobals },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {},
  },
  {
    files: ["src/**/*.test.ts"],
    languageOptions: {
      globals: { ...nodeGlobals, ...jestGlobals },
    },
  },
];
