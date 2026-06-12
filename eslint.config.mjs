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
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  jest: "readonly",
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
    rules: {
      // Core no-unused-vars misreports TS parameter properties and type-only
      // constructs; defer to the TypeScript-aware version instead.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.test.ts"],
    languageOptions: {
      globals: { ...nodeGlobals, ...jestGlobals },
    },
  },
];
