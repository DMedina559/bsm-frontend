/* global process */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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

  return {
    plugins: [react(), redirectApp()],
    base: "/app/",
    build: {
      outDir: "../../src/bedrock_server_manager/web/static/v2",
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
