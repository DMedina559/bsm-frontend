import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

const testImports = {
  group: [
    "**/tests/**",
    "**/*.test.*",
    "vitest",
    "@testing-library/*",
    "@playwright/test",
    "node:*",
  ],
  message: "Test helpers and tooling belong in tests, not application source.",
};

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/test-results/**",
      "**/playwright-report/**",
    ],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        __APP_VERSION__: "readonly",
        __THEME_REVISION__: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      prettier: prettierPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "prettier/prettier": "error",
      "react/prop-types": "off",
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "react-hooks/set-state-in-effect": "off",
    },
    settings: {
      react: {
        version: "18.3",
      },
    },
  },
  {
    files: ["**/*Context.jsx", "**/tests/support/utils.jsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["tests/**/*.{js,jsx}"],
    languageOptions: { globals: globals.jest },
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [testImports] }] },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/api/**", "src/pages/Content.jsx", "src/features/plugins/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [testImports],
          paths: [
            "./api/transport",
            "../api/transport",
            "../../api/transport",
          ].map((name) => ({
            name,
            importNames: ["request", "get", "post", "put", "del"],
            message:
              "Use callOperation for core API requests; the generic transport is reserved for plugin routes and file transfers.",
          })),
        },
      ],
    },
  },
  prettierConfig,
];
