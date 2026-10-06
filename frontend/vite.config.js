/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json" with { type: "json" };

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "child_process";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_URL || "http://localhost:11325";

  // Ensure WebSocket target uses correct protocol
  const wsTarget = target.startsWith("https")
    ? target.replace("https", "wss")
    : target.replace("http", "ws");

  let appVersion = packageJson.version || "unknown";
  try {
    const gitVersion = execSync("git describe --tags --always", {
      stdio: "pipe",
    })
      .toString()
      .trim();
    if (gitVersion) {
      appVersion = gitVersion;
    }
  } catch {
    console.warn(
      "Failed to get git version, falling back to package.json version",
    );
  }

  const themesDirectory = new URL(
    "./public/assets/css/themes/",
    import.meta.url,
  );
  const themeRevision = createHash("sha256");
  for (const file of readdirSync(themesDirectory)
    .filter((name) => name.endsWith(".css"))
    .sort()) {
    themeRevision.update(file);
    themeRevision.update(readFileSync(new URL(file, themesDirectory)));
  }
  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __THEME_REVISION__: JSON.stringify(
        themeRevision.digest("hex").slice(0, 12),
      ),
    },
    base: mode === "development" ? "/app/" : "./",
    build: {
      outDir: "../src/bsm_frontend/static",
      emptyOutDir: true,
    },
    server: {
      proxy: {
        "^/(api|auth|users|setup|server|plugin|plugins|content|audit-log|register|static|themes)":
          {
            target,
            changeOrigin: true,
          },
        "/ws": {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
    },
  };
});
