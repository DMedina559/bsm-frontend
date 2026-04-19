/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";

// Custom plugin to redirect /app to /app/
const redirectApp = () => ({
  name: "redirect-app",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/app") {
        res.writeHead(301, { Location: "/app/" });
        res.end();
      } else {
        next();
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_URL || "http://localhost:11325";

  // Ensure WebSocket target uses correct protocol
  const wsTarget = target.startsWith("https")
    ? target.replace("https", "wss")
    : target.replace("http", "ws");

  let appVersion = "unknown";
  try {
    appVersion = execSync("git describe --tags --always --dirty")
      .toString()
      .trim();
  } catch (e) {
    console.warn("Failed to get git version", e);
  }

  return {
    plugins: [react(), redirectApp()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    base: "/app/",
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
