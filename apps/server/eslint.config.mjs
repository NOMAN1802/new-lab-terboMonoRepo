import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    rules: {
      // The TypeScript compiler already resolves identifiers, and core
      // `no-undef` cannot see type-only globals such as `Express.Multer.File`.
      // typescript-eslint recommends disabling it for TS sources.
      "no-undef": "off",
      // Superseded by the typescript-eslint version; leaving both on reports
      // every finding twice.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "prefer-const": "error",
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["**/node_modules/", "**/dist/"],
  }
);
