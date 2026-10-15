import frontend from "./frontend/eslint.config.js";
export default [
  ...frontend.map((config) => ({
    ...config,
    ...(config.files
      ? {
          files: config.files.map((pattern) =>
            pattern.startsWith("src/") ? `frontend/${pattern}` : pattern,
          ),
        }
      : {}),
    ...(config.ignores
      ? {
          ignores: config.ignores.map((pattern) =>
            pattern.startsWith("src/") ? `frontend/${pattern}` : pattern,
          ),
        }
      : {}),
  })),
  {
    files: ["packages/**/*.js"],
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
