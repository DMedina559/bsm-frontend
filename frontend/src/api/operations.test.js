import { beforeEach, expect, it, vi } from "vitest";
import {
  callOperation,
  createOperationClient,
  resolveOperationUrl,
} from "./operations";
import { request } from "../api";
vi.mock("../api", () => ({ request: vi.fn() }));
beforeEach(() => request.mockReset());
it("encodes generated paths and rejects missing or unknown parameters", () => {
  expect(
    resolveOperationUrl("get_properties", {
      path: { server_name: "my server/one" },
    }),
  ).toBe("/api/server/my%20server%2Fone/properties/get");
  expect(() => resolveOperationUrl("get_properties")).toThrow("Missing path");
  expect(() =>
    resolveOperationUrl("get_properties", {
      path: { server_name: "one", typo: "x" },
    }),
  ).toThrow("Unknown path");
  expect(() =>
    resolveOperationUrl("list_servers", { query: { typo: true } }),
  ).toThrow("Unknown query");
  expect(() => callOperation("constructor")).toThrow("Unknown API operation");
});
it("encodes login form bodies and forwards session cancellation", async () => {
  const session = { generation: 1, signal: new AbortController().signal };
  await callOperation("login", {
    body: { username: "alice", password: "a&b" },
    session,
    timeout: 1000,
  });
  const [, options] = request.mock.calls[0];
  expect(options.body).toBeInstanceOf(URLSearchParams);
  expect(options.body.get("password")).toBe("a&b");
  expect(options.headers["Content-Type"]).toBe(
    "application/x-www-form-urlencoded",
  );
  expect(options.session).toBe(session);
  expect(options.timeout).toBe(1000);
  expect(() => callOperation("set_setting")).toThrow("Missing request body");
});
it("supports explicit plugin schema discovery, refs, serialized arrays and binary responses", async () => {
  const client = createOperationClient({
    components: {
      parameters: {
        values: { name: "values", in: "query", required: true, explode: false },
      },
    },
    paths: {
      "/api/plugin/export": {
        parameters: [{ $ref: "#/components/parameters/values" }],
        get: {
          operationId: "plugin_export",
          responses: {
            200: {
              content: {
                "application/octet-stream": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
      },
    },
  });
  expect(() => client.resolveOperationUrl("plugin_export")).toThrow(
    "Missing query",
  );
  expect(
    client.resolveOperationUrl("plugin_export", {
      query: { values: ["a", "b"] },
    }),
  ).toBe("/api/plugin/export?values=a%2Cb");
  await client.callOperation("plugin_export", { query: { values: ["a"] } });
  expect(request).toHaveBeenCalledWith(
    "/api/plugin/export?values=a",
    expect.objectContaining({ responseType: "blob" }),
  );
  expect(() =>
    createOperationClient({
      paths: {
        "/a": { get: { operationId: "same" } },
        "/b": { post: { operationId: "same" } },
      },
    }),
  ).toThrow("Duplicate operation ID");
});
it("discovers plugin operations over the session transport and rejects malformed schemas", async () => {
  const { discoverOperationClient } = await import("./operations");
  const session = { generation: 1, signal: new AbortController().signal };
  request.mockResolvedValueOnce({
    openapi: "3.1.0",
    paths: {
      "/api/plugin/new": { get: { operationId: "new_plugin_operation" } },
    },
  });
  const client = await discoverOperationClient("/api/plugin/openapi.json", {
    session,
  });
  expect(client.resolveOperationUrl("new_plugin_operation")).toBe(
    "/api/plugin/new",
  );
  expect(request).toHaveBeenCalledWith(
    "/api/plugin/openapi.json",
    expect.objectContaining({ session, method: "GET" }),
  );
  request.mockResolvedValueOnce({ paths: [] });
  await expect(discoverOperationClient()).rejects.toThrow("Invalid OpenAPI");
});
