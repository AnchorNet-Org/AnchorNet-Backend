import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: { console: "readonly", process: "readonly", __dirname: "readonly", __filename: "readonly", module: "readonly", require: "readonly", exports: "writable", Buffer: "readonly" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {},
  },
];
