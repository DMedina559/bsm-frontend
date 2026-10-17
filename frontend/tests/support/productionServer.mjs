import { createServer, request as proxyRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { WebSocketServer } from "ws";
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
const servers = [];
const sockets = [];
const allowed = new Set(
  [4173, 4174, 4175].map((port) => `http://127.0.0.1:${port}`),
);
const records = [];
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".html": "text/html",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
for (const port of [4176, 4177]) {
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization, content-type, cache-control, pragma",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    let body = "";
    for await (const part of req) body += part;
    const path = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    const token = req.headers.authorization?.replace("Bearer ", "");
    records.push({ port, path, token: token ?? null, origin: origin ?? null });
    let data = { status: "success" };
    let status = 200;
    if (path === "/audit/requests") data = records;
    else if (path === "/api/setup/status") data = { needs_setup: false };
    else if (path === "/auth/token")
      data = {
        access_token: `${port}-${new URLSearchParams(body).get("username")}`,
        token_type: "bearer",
      };
    else if (path === "/api/account") {
      if (!token?.startsWith(`${port}-`)) {
        status = 401;
        data = { detail: "Sign in" };
      } else
        data = {
          id: token,
          username: token.slice(5),
          role: "admin",
          theme: "default",
        };
    } else if (path === "/api/servers")
      data = { status: "success", servers: [] };
    else if (path === "/api/tasks/list") data = [];
    else if (path === "/api/openapi.json")
      data = JSON.parse(
        await readFile(
          new URL(
            "../../../packages/api-client/src/generated/openapi.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    else if (path.includes("themes")) data = { themes: ["default"] };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  });
  const wss = new WebSocketServer({ noServer: true });
  sockets.push(wss);
  server.on("upgrade", (req, socket, head) => {
    if (!allowed.has(req.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => {
      client.on("message", (raw) => {
        const message = JSON.parse(String(raw));
        if (message.action === "authenticate") {
          records.push({
            port,
            path: "/ws",
            token: message.token,
            origin: req.headers.origin,
          });
          client.send(
            JSON.stringify({
              status: "success",
              message: "Authenticated successfully",
            }),
          );
        }
      });
    });
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  servers.push(server);
}
for (const [port, base, config, prefix] of [
  [4173, "/app", {}, ""],
  [
    4174,
    "",
    { mode: "standalone", appBase: "/", backendUrl: "http://127.0.0.1:4176" },
    "",
  ],
  [4175, "/ingress/test/app", {}, "/ingress/test"],
]) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(
      new URL(req.url, `http://127.0.0.1:${port}`).pathname,
    );
    if (
      prefix &&
      path.startsWith(`${prefix}/`) &&
      !path.startsWith(`${base}/`)
    ) {
      const upstream = proxyRequest(
        {
          hostname: "127.0.0.1",
          port: 4176,
          path: path.slice(prefix.length),
          method: req.method,
          headers: req.headers,
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      req.pipe(upstream);
      return;
    }
    let relative = path.startsWith(base + "/")
      ? path.slice(base.length + 1)
      : "";
    if (!relative || !extname(relative)) relative = "index.html";
    const target = resolve(dist, relative);
    if (!target.startsWith(resolve(dist) + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      let content = await readFile(target);
      if (relative === "index.html") {
        content = Buffer.from(
          content
            .toString()
            .replace(
              /(<script id="bsm-config" type="application\/json">)[\s\S]*?(<\/script>)/,
              `$1${JSON.stringify(config)}$2`,
            )
            .replace(
              '<base id="app-asset-base" href="/app/"',
              `<base data-api-base="${prefix}" id="app-asset-base" href="${base || ""}/"`,
            ),
        );
      }
      res.writeHead(200, {
        "content-type": mime[extname(target)] ?? "application/octet-stream",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Missing static asset");
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  servers.push(server);
}
process.on("SIGTERM", () => {
  sockets.forEach((server) => {
    server.clients.forEach((client) => client.terminate());
    server.close();
  });
  servers.forEach((server) => server.close());
});
