import globals from "globals";
import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  // Global ignores
  {
    ignores: ["node_modules/**", "public/**", "dist/**", "uploads/**", ".env"],
  },

  // JavaScript files (CommonJS)
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
      },
    },
  },

  // ESLint recommended rules
  js.configs.recommended,

  // Prettier integration (must be last to override other rules)
  {
    ...eslintPluginPrettierRecommended,
    rules: {
      ...eslintPluginPrettierRecommended.rules,
      "prettier/prettier": [
        "error",
        {
          // These options should mirror your Prettier config
          semi: true,
          trailingComma: "es5",
          singleQuote: false,
          printWidth: 100,
          tabWidth: 2,
          useTabs: false,
          bracketSpacing: true,
        },
      ],
    },
  },
];
