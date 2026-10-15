import js from "@eslint/js";
import globals from "globals";
import frontend from "./frontend/eslint.config.js";
export default [
  { ignores: ["packages/*/dist/**"] },
  ...frontend.map((config) => ({
    ...config,
    ...(config.files
      ? {
          files: config.files.map((pattern) =>
            /^(src|tests)\//.test(pattern) ? `frontend/${pattern}` : pattern,
          ),
        }
      : {}),
    ...(config.ignores
      ? {
          ignores: config.ignores.map((pattern) =>
            /^(src|tests)\//.test(pattern) ? `frontend/${pattern}` : pattern,
          ),
        }
      : {}),
  })),
  {
    files: ["scripts/**/*.mjs", "packages/*/scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: js.configs.recommended.rules,
  },
  {
    files: ["packages/**/*.js"],
    ignores: ["packages/*/dist/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "localStorage",
        "sessionStorage",
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/frontend/**",
            "react",
            "react-dom",
            "@tanstack/react-query",
          ],
        },
      ],
    },
    languageOptions: { globals: { process: "readonly", Buffer: "readonly" } },
  },
];
