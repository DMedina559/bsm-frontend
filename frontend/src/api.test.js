import { describe, it, expect, vi, beforeEach } from "vitest";
import { request, ApiError, getApiBaseUrl, setApiBaseUrl } from "./api";

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

  describe("request", () => {
    it("handles 204 No Content", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 204,
        }),
      );
      const res = await request("/test");
      expect(res).toBeNull();
    });

    it("handles valid JSON response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ data: "test" }),
        }),
      );
      const res = await request("/test");
      expect(res).toEqual({ data: "test" });
    });

    it("handles invalid JSON response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.reject(new Error("Invalid JSON")),
        }),
      );
      await expect(request("/test")).rejects.toThrow(ApiError);
      await expect(request("/test")).rejects.toThrow(
        "Invalid JSON response from server",
      );
    });

    it("handles non-JSON response error", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 404,
          ok: false,
          headers: new Headers({ "content-type": "text/html" }),
          text: () => Promise.resolve("Not Found"),
        }),
      );
      await expect(request("/test")).rejects.toThrow(ApiError);
    });

    it("handles non-JSON HTML redirect response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "text/html" }),
          text: () => Promise.resolve("<!doctype html><html></html>"),
        }),
      );
      await expect(request("/test")).rejects.toThrow(
        "Session expired (Redirected to App)",
      );
    });

    it("handles API error with detail", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 400,
          ok: false,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ detail: "Bad Request Detail" }),
        }),
      );
      await expect(request("/test")).rejects.toThrow("Bad Request Detail");
    });

    it("handles legacy API error in 200 response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () =>
            Promise.resolve({ status: "error", message: "Legacy Error" }),
        }),
      );
      await expect(request("/test")).rejects.toThrow("Legacy Error");
    });

    it("handles network error", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.reject(new Error("Network Error")),
      );
      await expect(request("/test")).rejects.toThrow("Network Error");
    });
  });

  describe("helper methods", () => {
    it("sends GET requests", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await request("/test", { method: "GET" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("serializes POST request bodies", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await request("/test", { method: "POST", body: { data: "test" } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    it("serializes PUT request bodies", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await request("/test", { method: "PUT", body: { data: "test" } });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    it("sends DELETE requests", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await request("/test", { method: "DELETE" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});

describe("authenticated API URL routing", () => {
  it("blocks credential transmission to foreign origins", async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "sensitive-token");
    globalThis.fetch = vi.fn();
    await expect(
      request("https://untrusted.example/api/action"),
    ).rejects.toThrow("configured backend");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
it("binary downloads reject stale sessions after reading the response body", async () => {
  const { getBlob } = await import("./api");
  const { sessionRuntime } = await import("./app/sessionRuntime");
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
  const { getBlob } = await import("./api");
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
  const { downloadFile } = await import("./api");
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
  const { sessionRuntime } = await import("./app/sessionRuntime");
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
  const { callOperation } = await import("./api/operations");
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
  sessionStorage.setItem("access_token", "current-token");
  await callOperation("reauthenticate", { query: { remember_me: false } });
  const [reauthUrl, reauthRequest] = fetch.mock.calls[1];
  expect(reauthUrl).toBe("/auth/reauth?remember_me=false");
  expect(reauthRequest.body).toBeUndefined();
  expect(reauthRequest.headers.Authorization).toBe("Bearer current-token");
});

it("encodes server parameters and preserves task tracking for generated backup calls", async () => {
  const { callOperation } = await import("./api/operations");
  const { operationCoordinator } = await import("./app/operationCoordinator");
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
