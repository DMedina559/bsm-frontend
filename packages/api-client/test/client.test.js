import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApiClient } from "../src/operations.js";
import { createHttpTransport, ApiError } from "../src/transport.js";
import { createUrlResolver } from "../src/urls.js";

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
