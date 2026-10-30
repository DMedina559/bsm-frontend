import test from "node:test";
import assert from "node:assert/strict";
import {
  createHttpTransport,
  ApiError,
} from "@bedrock-server-manager/api-client/transport";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";
const transport = (fetch, options = {}) =>
  createHttpTransport({
    baseUrl: "https://bsm.example/prefix",
    fetch,
    ...options,
  });

test("transport reads JSON and empty responses and serializes write methods", async () => {
  for (const method of ["GET", "POST", "PUT", "DELETE"]) {
    let request;
    const client = transport(async (url, options) => {
      request = { url, ...options };
      return Response.json({ ok: true });
    });
    assert.deepEqual(
      await client.request("/api/test", {
        method,
        ...(method === "POST" || method === "PUT"
          ? { body: { value: 1 } }
          : {}),
      }),
      { ok: true },
    );
    assert.equal(request.method, method);
    assert.equal(request.url, "https://bsm.example/prefix/api/test");
    if (method === "POST" || method === "PUT")
      assert.equal(request.body, '{"value":1}');
  }
  assert.equal(
    await transport(async () => new Response(null, { status: 204 })).request(
      "/api/test",
    ),
    null,
  );
});

test("transport classifies malformed JSON, HTML, application, HTTP and network errors", async () => {
  for (const [response, message] of [
    [
      () =>
        new Response("invalid", {
          headers: { "content-type": "application/json" },
        }),
      "Invalid JSON",
    ],
    [() => new Response("<!doctype html><html></html>"), "Session expired"],
    [() => new Response("Not Found", { status: 404 }), "Non-JSON"],
    [
      () => Response.json({ detail: "Bad request" }, { status: 400 }),
      "Bad request",
    ],
    [
      () => Response.json({ status: "error", message: "Application failed" }),
      "Application failed",
    ],
  ])
    await assert.rejects(
      transport(async () => response()).request("/api/test"),
      (error) => error instanceof ApiError && error.message.includes(message),
    );
  await assert.rejects(
    transport(async () => {
      throw Error("Network failed");
    }).request("/api/test"),
    { status: 0 },
  );
});

test("headers are case insensitive and credential headers are redacted", async () => {
  const logs = [];
  let headers;
  const client = transport(
    async (_url, options) => {
      headers = new Headers(options.headers);
      return Response.json({});
    },
    {
      getToken: () => "secret",
      logger: { debug: (...args) => logs.push(args), warn() {}, error() {} },
    },
  );
  await client.request("/api/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "old-secret",
    },
    body: { value: 1 },
  });
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("authorization"), "Bearer secret");
  assert.ok(!JSON.stringify(logs).includes("old-secret"));
  assert.ok(!JSON.stringify(logs).includes("Bearer secret"));
});

test("timeouts and session cancellation interrupt unresolved credential providers", async () => {
  const client = transport(
    async () => {
      throw Error("Must not fetch");
    },
    { getToken: () => new Promise(() => {}) },
  );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(client.request("/api/test", { timeout: 5 }), {
      name: "TimeoutError",
    });
  } finally {
    clearTimeout(keepAlive);
  }
  const controller = new AbortController();
  const pending = client.request("/api/test", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("cancellation while decoding JSON retains the cancellation reason", async () => {
  const controller = new AbortController();
  const client = transport(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => {
      controller.abort();
      throw controller.signal.reason;
    },
  }));
  await assert.rejects(
    client.request("/api/test", { signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("backend URLs retain their path boundary, including encoded traversal and absolute URLs", () => {
  const resolve = createUrlResolver("https://bsm.example/ingress/one/");
  for (const path of [
    "/../../api/account",
    "/%2e%2e/%2e%2e/api/account",
    "https://bsm.example/ingress/two/api",
    "//foreign.example/api",
  ])
    assert.throws(() => resolve(path));
  assert.equal(
    resolve("/api/account"),
    "https://bsm.example/ingress/one/api/account",
  );
});

test("zero timeout allows archive transfers while retaining cancellation", async () => {
  const client = transport(async (_url, { signal }) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(signal.aborted, false);
    return Response.json({ complete: true });
  });
  assert.deepEqual(await client.request("/api/archive", { timeout: 0 }), {
    complete: true,
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    client.request("/api/archive", { timeout: 0, signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("native archive downloads stream to disk with progress without a Blob", async () => {
  const writes = [];
  const progress = [];
  let closed = false;
  const destination = new WritableStream({
    write(chunk) {
      writes.push(...chunk);
    },
    close() {
      closed = true;
    },
  });
  const client = transport(
    async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": "3",
        },
      }),
  );
  const result = await client.request("/api/archive", {
    responseType: "blob",
    downloadTo: destination,
    onDownloadProgress: (loaded, total) => progress.push([loaded, total]),
  });
  assert.equal(result, null);
  assert.deepEqual(writes, [1, 2, 3]);
  assert.equal(closed, true);
  assert.deepEqual(progress.at(-1), [3, 3]);
});

test("cancelled downloads abort partial destination files", async () => {
  const controller = new AbortController();
  let aborted = false;
  const destination = new WritableStream({
    write() {
      controller.abort();
    },
    abort() {
      aborted = true;
    },
  });
  const client = transport(async () => new Response(new Uint8Array([1, 2, 3])));
  await assert.rejects(
    client.request("/api/archive", {
      responseType: "blob",
      downloadTo: destination,
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(aborted, true);
});

test("multipart uploads use native progress and retain authorization and cancellation", async () => {
  const original = globalThis.XMLHttpRequest;
  let request;
  class FakeXHR {
    upload = {};
    headers = {};
    status = 200;
    response = new Blob(['{"ok":true}']);
    open(method, url) {
      this.method = method;
      this.url = url;
      request = this;
    }
    setRequestHeader(key, value) {
      this.headers[key] = value;
    }
    getAllResponseHeaders() {
      return "content-type: application/json\r\n";
    }
    send(body) {
      this.body = body;
      this.upload.onprogress({
        loaded: 100,
        total: 100,
        lengthComputable: true,
      });
      queueMicrotask(() => this.onload());
    }
    abort() {
      this.onabort?.();
    }
  }
  globalThis.XMLHttpRequest = FakeXHR;
  try {
    const progress = [];
    const client = transport(
      () => {
        throw new Error("must use native upload");
      },
      { getToken: () => "credential" },
    );
    const form = new FormData();
    form.append("file", new Blob(["archive"]), "backup.bsmbackup");
    assert.deepEqual(
      await client.request("/api/import", {
        method: "POST",
        body: form,
        onUploadProgress: (loaded) => progress.push(loaded),
      }),
      { ok: true },
    );
    assert.equal(request.body, form);
    assert.equal(request.headers.Authorization, "Bearer credential");
    assert.deepEqual(progress, [100]);
  } finally {
    globalThis.XMLHttpRequest = original;
  }
});

test("response metadata is available for JSON, errors and empty responses", async () => {
  for (const status of [200, 204, 422]) {
    let metadata;
    const client = transport(async (_url, options) => {
      assert.equal(options.onResponseMetadata, undefined);
      return new Response(status === 204 ? null : '{"ok":true}', {
        status,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      await client.request("/api/example", {
        onResponseMetadata: (value) => {
          metadata = value;
        },
      });
    } catch (error) {
      assert.equal(error.status, 422);
    }
    assert.equal(metadata.status, status);
    assert.equal(metadata.headers["content-type"], "application/json");
  }
});
