import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApiClient } from "@bedrock-server-manager/api-client";
import {
  createHttpTransport,
  ApiError,
} from "@bedrock-server-manager/api-client/transport";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";

test("client authenticates and serializes operations against a real HTTP server without a browser", async () => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, auth: req.headers.authorization });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ servers: [] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/prefix`;
    const one = createApiClient(
      createHttpTransport({ baseUrl, getToken: async () => "one" }),
    );
    const two = createApiClient(
      createHttpTransport({ baseUrl, getToken: () => "two" }),
    );
    assert.deepEqual(await one.callOperation("list_servers"), { servers: [] });
    await two.callOperation("list_servers");
    assert.deepEqual(
      requests.map((r) => r.auth),
      ["Bearer one", "Bearer two"],
    );
    assert.ok(requests.every((r) => r.url.startsWith("/prefix/api/")));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("URL resolution rejects foreign credentials and retains ingress prefixes", () => {
  const resolve = createUrlResolver("https://bsm.example/ingress/test/");
  assert.equal(
    resolve("/api/servers"),
    "https://bsm.example/ingress/test/api/servers",
  );
  for (const target of [
    "https://other.example/api",
    "//other.example/api",
    "https://user@bsm.example/api",
  ])
    assert.throws(() => resolve(target));
});

test("HTTP errors preserve committed operation results", async () => {
  const transport = createHttpTransport({
    baseUrl: "https://bsm.example",
    fetch: async () =>
      Response.json(
        {
          error: {
            code: "operation_incomplete",
            message: "Follow-up failed",
            details: { result: { committed: true } },
          },
        },
        { status: 500 },
      ),
  });
  await assert.rejects(
    transport.request("/api/test"),
    (error) =>
      error instanceof ApiError &&
      error.committed &&
      error.category === "incomplete",
  );
});

test("an expired session cannot send credentials after an asynchronous credential read", async () => {
  const controller = new AbortController();
  let release;
  let sent = false;
  const transport = createHttpTransport({
    baseUrl: "https://bsm.example",
    getToken: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    captureSession: () => ({ signal: controller.signal }),
    fetch: async () => {
      sent = true;
      return Response.json({});
    },
  });
  const pending = transport.request("/api/test");
  controller.abort();
  release("old-token");
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(sent, false);
});

test("contract metadata and capability inspection use the same schema interpretation as discovery", async () => {
  const { contractMetadata, compareCapabilities } =
    await import("@bedrock-server-manager/api-client/metadata");
  const schema = {
    openapi: "3.1.0",
    info: { version: "4.0.0" },
    paths: {
      "/api/ping": { get: { operationId: "ping", responses: { 200: {} } } },
    },
  };
  assert.match(contractMetadata.schemaHash, /^[a-f0-9]{64}$/);
  assert.ok(contractMetadata.operations.includes("list_servers"));
  assert.deepEqual(compareCapabilities(schema, ["ping", "missing"]), {
    missing: ["missing"],
    backendVersion: "4.0.0",
  });
  const client = createApiClient({ request: async () => schema });
  const result = await client.inspectBackendContract();
  assert.equal(result.schemaHash, contractMetadata.schemaHash);
  assert.ok(result.missing.includes("list_servers"));
});

test("health preserves runtime identity and degraded observations with user authentication", async () => {
  for (const [instance_id, ready] of [
    ["runtime-1", true],
    [null, false],
  ]) {
    const health = {
      pid: 123,
      instance_id,
      version: "4.0.0b8",
      ready,
      lifecycle: ready ? "ready" : "stopping",
      health: ready ? "healthy" : "degraded",
      checks: { lifecycle: { healthy: ready, message: "Lifecycle check" } },
      checked_at: 1,
    };
    const client = createApiClient(
      createHttpTransport({
        baseUrl: "https://bsm.example/prefix",
        getToken: () => "user-token",
        fetch: async (url, options) => {
          assert.equal(url, "https://bsm.example/prefix/api/health");
          const headers = new Headers(options.headers);
          assert.equal(headers.get("Authorization"), "Bearer user-token");
          assert.equal(headers.has("X-BSM-Readiness-Token"), false);
          return Response.json(health);
        },
      }),
    );
    assert.deepEqual(
      await client.callOperation("get_application_health"),
      health,
    );
  }
});
