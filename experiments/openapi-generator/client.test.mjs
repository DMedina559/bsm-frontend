import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createPrototypeClient } from "./client.mjs";
import { ApiError } from "../../packages/api-client/src/transport.js";

function fixture(
  respond = () => Response.json({ status: "success" }),
  options = {},
) {
  const calls = [];
  const client = createPrototypeClient({
    baseUrl: "https://bsm.test/prefix/",
    getToken: () => "example-token",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return respond(url, init);
    },
    ...options,
  });
  return { client, calls };
}

test("generated SDK covers every schema operation", async () => {
  const schema = JSON.parse(
    await readFile(
      new URL(
        "../../packages/api-client/src/generated/openapi.json",
        import.meta.url,
      ),
    ),
  );
  const expected = Object.values(schema.paths).flatMap((path) =>
    Object.entries(path)
      .filter(([method]) =>
        [
          "get",
          "post",
          "put",
          "delete",
          "patch",
          "head",
          "options",
          "trace",
        ].includes(method),
      )
      .map(([, operation]) => operation.operationId),
  );
  const files = await readdir(new URL("generated/apis/", import.meta.url));
  const source = (
    await Promise.all(
      files
        .filter((f) => f.endsWith(".ts"))
        .map((f) =>
          readFile(new URL(`generated/apis/${f}`, import.meta.url), "utf8"),
        ),
    )
  ).join("\n");
  for (const id of expected) {
    const method = id.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    assert.ok(
      source.includes(`async ${method}Raw(`),
      `Missing operation: ${id}`,
    );
  }
  console.log(`Checked ${expected.length} schema operations`);
});

test("bearer credentials and backend prefixes stay per instance", async () => {
  const a = fixture(() => Response.json({ username: "alice" }));
  const b = fixture(() => Response.json({ username: "bob" }), {
    baseUrl: "https://second.test/bsm",
    getToken: () => "other-token",
  });
  assert.equal(
    (await a.client.AccountManagementApi.getAccount()).username,
    "alice",
  );
  await b.client.AccountManagementApi.getAccount();
  assert.equal(a.calls[0].url, "https://bsm.test/prefix/api/account");
  assert.equal(
    a.calls[0].init.headers.get("Authorization"),
    "Bearer example-token",
  );
  assert.equal(b.calls[0].url, "https://second.test/bsm/api/account");
  assert.equal(
    b.calls[0].init.headers.get("Authorization"),
    "Bearer other-token",
  );
  assert.equal(a.calls[0].init.credentials, "omit");
});

test("password login is form encoded without ambient bearer credentials", async () => {
  const { client, calls } = fixture(() =>
    Response.json({ access_token: "new-token", token_type: "bearer" }),
  );
  await client.AuthenticationApi.login({
    username: "alice",
    password: "not-a-real-password",
    remember_me: false,
  });
  assert.ok(calls[0].init.body instanceof URLSearchParams);
  assert.equal(calls[0].init.body.get("username"), "alice");
  assert.equal(calls[0].init.headers.has("Authorization"), false);
  assert.equal(calls[0].init.headers.get("X-BSM-Auth-Mode"), "bearer");
});

test("JSON requests preserve omitted fields versus explicit null", async () => {
  const { client, calls } = fixture();
  for (const body of [
    { name: "test", permissions: ["account:read"] },
    {
      name: "test",
      permissions: ["account:read"],
      expires_in_days: null,
      server_ids: null,
    },
  ]) {
    await client.AccessManagementApi.createIntegrationToken({
      CreateIntegrationToken: body,
    });
  }
  assert.equal(
    Object.hasOwn(JSON.parse(calls[0].init.body), "expires_in_days"),
    false,
  );
  assert.equal(JSON.parse(calls[1].init.body).expires_in_days, null);
  assert.equal(JSON.parse(calls[1].init.body).server_ids, null);
});

test("multipart files and path encoding reach Fetch unchanged", async () => {
  const { client, calls } = fixture();
  await client.BackupRestoreApi.importServerSnapshot({
    server_name: "server name/one",
    file: new Blob(["archive"], { type: "application/zip" }),
    recovery_key: "example-key",
  });
  assert.match(calls[0].url, /server%20name%2Fone/);
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal(await calls[0].init.body.get("file").text(), "archive");
  assert.equal(calls[0].init.body.get("recovery_key"), "example-key");
  assert.equal(calls[0].init.headers.has("Content-Type"), false);
});

test("binary downloads and raw streaming responses remain available", async () => {
  const { client } = fixture(
    () =>
      new Response(new Uint8Array([0, 1, 255]), {
        headers: { "Content-Type": "application/zip" },
      }),
  );
  const options = { server_name: "server", backup_id: "backup" };
  const file = await client.BackupRestoreApi.downloadServerSnapshot(options);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [0, 1, 255]);
  const raw = await client.BackupRestoreApi.downloadServerSnapshotRaw(options);
  const chunks = [];
  await raw.raw.body.pipeTo(
    new WritableStream({
      write(chunk) {
        chunks.push(...chunk);
      },
    }),
  );
  assert.deepEqual(chunks, [0, 1, 255]);
});

test("structured HTTP failures retain BSM error metadata without retrying", async () => {
  const data = {
    error: {
      code: "operation_incomplete",
      message: "Follow-up failed",
      details: { result: { committed: true } },
    },
  };
  const { client, calls } = fixture(() => Response.json(data, { status: 409 }));
  await assert.rejects(client.AccountManagementApi.getAccount(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "operation_incomplete");
    assert.equal(error.committed, true);
    assert.equal(error.category, "incomplete");
    return true;
  });
  assert.equal(calls.length, 1);
});

test("caller cancellation aborts an in-flight generated request", async () => {
  const controller = new AbortController();
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const { client, calls } = fixture(
    (_, init) =>
      new Promise((resolve, reject) => {
        assert.equal(init.signal, controller.signal);
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        );
        entered();
      }),
  );
  const request = client.AccountManagementApi.getAccount({
    signal: controller.signal,
  });
  await started;
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
  assert.equal(calls.length, 1);
});

test("already-aborted calls never send requests", async () => {
  const { client, calls } = fixture();
  await assert.rejects(
    client.AccountManagementApi.getAccount({ signal: AbortSignal.abort() }),
    { name: "AbortError" },
  );
  assert.equal(calls.length, 0);
});

test("network failures use the BSM error class", async () => {
  const { client, calls } = fixture(() => {
    throw new TypeError("Offline");
  });
  await assert.rejects(
    client.AccountManagementApi.getAccount(),
    (error) => error instanceof ApiError && error.status === 0,
  );
  assert.equal(calls.length, 1);
});
