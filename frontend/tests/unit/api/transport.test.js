import { setCredentials } from "../../../src/app/connection";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  request,
  ApiError,
  getApiBaseUrl,
  setApiBaseUrl,
} from "../../../src/api/transport";

describe("api", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("getApiBaseUrl returns empty string if not set", () => {
    expect(getApiBaseUrl()).toBe("");
  });

  it("setApiBaseUrl sets the base URL correctly", () => {
    setApiBaseUrl("http://test.com/");
    expect(getApiBaseUrl()).toBe("http://test.com");
  });

  it("setApiBaseUrl removes the base URL if falsy", () => {
    setApiBaseUrl("http://test.com");
    setApiBaseUrl("");
    expect(getApiBaseUrl()).toBe("");
  });
});

describe("authenticated API URL routing", () => {
  it("blocks credential transmission to foreign origins", async () => {
    localStorage.clear();
    setCredentials("sensitive-token", true);
    globalThis.fetch = vi.fn();
    await expect(
      request("https://untrusted.example/api/action"),
    ).rejects.toThrow("configured backend");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
it("binary downloads reject stale sessions after reading the response body", async () => {
  const { getBlob } = await import("../../../src/api/transport");
  const { sessionRuntime } = await import("../../../src/app/sessionRuntime");
  let finish;
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    blob: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const promise = getBlob("/api/download/test");
  const assertion = expect(promise).rejects.toMatchObject({
    name: "AbortError",
  });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  sessionRuntime.reset();
  finish(new Blob(["old account"]));
  await assertion;
});
it("binary requests normalize backend validation failures", async () => {
  const { getBlob } = await import("../../../src/api/transport");
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 422,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      detail: [{ loc: ["query", "file"], msg: "Required" }],
    }),
  });
  await expect(getBlob("/api/download/test")).rejects.toMatchObject({
    category: "validation",
    message: "query.file: Required",
  });
});

it("downloads revoke object URLs even if clicking the link fails", async () => {
  const { downloadFile } = await import("../../../src/api/transport");
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    blob: async () => new Blob(["data"]),
  });
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {
      throw new Error("click failed");
    });
  await expect(downloadFile("/api/download/test")).rejects.toThrow(
    "click failed",
  );
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  expect(document.querySelector('a[href="blob:test"]')).toBeNull();
  click.mockRestore();
});
it("bound session transport refuses later requests after logout before fetch", async () => {
  const { sessionRuntime } = await import("../../../src/app/sessionRuntime");
  const session = sessionRuntime.capture();
  sessionRuntime.reset();
  globalThis.fetch = vi.fn();
  await expect(
    request("/api/settings/set", {
      method: "POST",
      body: { key: "name", value: "second step" },
      session,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
});
it("serializes explicit JSON objects and scalar zero without losing the request body", async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 204 });
  await request("/api/example", {
    method: "POST",
    body: { value: 1 },
    headers: { "Content-Type": "application/json" },
  });
  expect(fetch.mock.calls[0][1].body).toBe('{"value":1}');
  await request("/api/example", { method: "POST", body: 0 });
  expect(fetch.mock.calls[1][1].body).toBe("0");
});

it.each([400, 403, 404, 409, 422, 500])(
  "preserves the backend error envelope for HTTP %s",
  async (status) => {
    const error = {
      code: "validation_error",
      message: "Invalid request.",
      details: {
        errors: [{ location: ["body", "subpack_name"], code: "missing" }],
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error }),
    });
    await expect(
      request("/api/server/Survival/addon/subpack"),
    ).rejects.toMatchObject({
      message: error.message,
      code: error.code,
      details: error.details,
      data: { error },
      status,
    });
  },
);

it("uses the generated login and reauthentication contracts through the authenticated transport", async () => {
  const { callOperation } = await import("../../../src/api/operations");
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ access_token: "renewed", token_type: "bearer" }),
  });
  await callOperation("login", {
    body: { username: "alice", password: "a&b", remember_me: true },
  });
  const [loginUrl, loginRequest] = fetch.mock.calls[0];
  expect(loginUrl).toBe("/auth/token");
  expect(loginRequest.method).toBe("POST");
  expect(loginRequest.body.get("password")).toBe("a&b");
  expect(loginRequest.headers["Content-Type"]).toBe(
    "application/x-www-form-urlencoded",
  );
  setCredentials("current-token");
  await callOperation("reauthenticate", { query: { remember_me: false } });
  const [reauthUrl, reauthRequest] = fetch.mock.calls[1];
  expect(reauthUrl).toBe("/auth/reauth?remember_me=false");
  expect(reauthRequest.body).toBeUndefined();
  expect(reauthRequest.headers.Authorization).toBe("Bearer current-token");
});

it("encodes server parameters and preserves task tracking for generated backup calls", async () => {
  const { callOperation } = await import("../../../src/api/operations");
  const { operationCoordinator } =
    await import("../../../src/app/operationCoordinator");
  operationCoordinator.clear();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 202,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ status: "accepted", task_id: "backup-123" }),
  });
  const body = { backup_type: "world" };
  await callOperation("create_backup", {
    path: { server_name: "my server/one" },
    body,
  });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("/api/server/my%20server%2Fone/backup/action");
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual(body);
  expect(operationCoordinator.get("backup-123")).toMatchObject({
    serverName: "my server/one",
    status: "pending",
  });
  operationCoordinator.clear();
});
it("does not register an old mutation task after the backend restarts", async () => {
  const { stateReconciler } = await import("../../../src/app/stateReconciler");
  const { operationCoordinator } =
    await import("../../../src/app/operationCoordinator");
  stateReconciler.clear();
  operationCoordinator.clear();
  stateReconciler.accept(["monitor"], { epoch: "first", revision: 100 });
  let finish;
  globalThis.fetch = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = request("/api/server/alpha/backup", { method: "POST" });
  stateReconciler.accept(
    ["monitor"],
    { epoch: "next", revision: 1 },
    { ticket: stateReconciler.capture() },
  );
  finish({
    status: 200,
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ status: "accepted", task_id: "old-task" }),
  });
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(operationCoordinator.get("old-task")).toBeNull();
  stateReconciler.clear();
});

it("retains committed operation details and warns before retrying", () => {
  const result = {
    committed: true,
    action: "change_password",
    resource: "account",
  };
  const error = new ApiError("Operation incomplete.", 500, {
    error: { code: "operation_incomplete", details: { result } },
  });
  expect(error.category).toBe("incomplete");
  expect(error.committed).toBe(true);
  expect(error.operationResult).toEqual(result);
  expect(error.message).toContain("change was saved");
});

it("classifies service outages separately from network failures", () => {
  const error = new ApiError("Service unavailable.", 503, {
    error: { code: "unavailable", details: {} },
  });
  expect(error.category).toBe("unavailable");
  expect(error.code).toBe("unavailable");
});
