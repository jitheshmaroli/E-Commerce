import globals from "globals";
import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    files: ["eslint.config.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    ignores: ["node_modules/**", "public/**", "dist/**", "views/**", ".env", "uploads/**"],
  },
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
  js.configs.recommended,
  {
    // Spread the recommended config (includes the plugin and base rules)
    ...eslintPluginPrettierRecommended,
    // Override just the prettier/prettier rule with your custom options
    rules: {
      ...eslintPluginPrettierRecommended.rules,
      "prettier/prettier": [
        "error",
        {
          semi: true,
          trailingComma: "es5",
          singleQuote: false, // double quotes
          printWidth: 100,
          tabWidth: 2,
          useTabs: false,
          bracketSpacing: true,
          // Add any other options from your .prettierrc.json here if you add more later
        },
      ],
    },
  },
];
