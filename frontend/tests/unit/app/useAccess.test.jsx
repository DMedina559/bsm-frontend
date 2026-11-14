/** @vitest-environment jsdom */
import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAccess, useServerAccess } from "../../../src/app/useAccess";
import { queryClient } from "../../../src/app/queryClient";
import { callOperation } from "../../../src/api/operations";
import { loadAccessSchema } from "../../../src/api/access";
vi.mock("../../../src/api/operations", () => ({ callOperation: vi.fn() }));
vi.mock("../../../src/api/access", () => ({ loadAccessSchema: vi.fn() }));
let user;
let generation;
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user, sessionGeneration: generation }),
}));
const operation = (id, scopes, scope = "server") => ({
  operationId: id,
  "x-bsm-access": {
    version: 1,
    classification: "permission",
    authentication: "required",
    resource_scope: scope,
    required_permissions: scopes,
  },
});
const schema = (scope) => ({
  openapi: "3.1.0",
  paths: {
    "/start": { post: operation("start_server", [scope]) },
    "/stop": { post: operation("stop_server", ["future:stop"]) },
    "/resources": {
      get: operation("list_access_servers", ["future:list"], "collection"),
    },
  },
});
beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  generation = 1;
  user = {
    id: 1,
    role: "admin",
    permissions: ["future:start", "future:list"],
    server_access: "assigned",
    policy_revision: "r1",
  };
  loadAccessSchema.mockResolvedValue(schema("future:start"));
  callOperation.mockImplementation(async (id) =>
    id === "get_access_policy"
      ? { server_permissions: ["future:start", "future:stop", "future:list"] }
      : [
          { name: "Alpha", permissions: ["future:start", "future:list"] },
          { name: "Beta", permissions: ["future:list"] },
        ],
  );
});
it("waits for runtime discovery and per-server grants, and checks lifecycle operations separately", async () => {
  const { result } = renderHook(() => useServerAccess("Alpha"));
  expect(result.current.canStart).toBe(false);
  await waitFor(() => expect(result.current.canStart).toBe(true));
  expect(result.current.canStop).toBe(false);
  expect(result.current.can("start_server", "Beta")).toBe(false);
  expect(result.current.can("unknown")).toBe(false);
});
it("refreshes scope names after a backend policy revision instead of keeping the old table", async () => {
  const { result, rerender } = renderHook(() => useAccess());
  await waitFor(() =>
    expect(result.current.can("start_server", "Alpha")).toBe(true),
  );
  user = { ...user, policy_revision: "r2", permissions: ["renamed:start"] };
  loadAccessSchema.mockResolvedValue(schema("renamed:start"));
  callOperation.mockResolvedValue({ server_permissions: ["renamed:start"] });
  rerender();
  await waitFor(() =>
    expect(result.current.permissionsFor("start_server")).toEqual([
      "renamed:start",
    ]),
  );
  expect(result.current.can("start_server", "Alpha")).toBe(false);
});
it("keeps discovery failures unknown without granting administrator access", async () => {
  loadAccessSchema.mockRejectedValue(new Error("Discovery unavailable"));
  const { result } = renderHook(() => useAccess());
  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(result.current.can("start_server", "Alpha")).toBe(false);
  expect(result.current.access("start_server").state).toBe("unknown");
});
it("does not reuse another credential's discovered grants", async () => {
  const { result, rerender } = renderHook(() => useServerAccess("Alpha"));
  await waitFor(() => expect(result.current.canStart).toBe(true));
  generation = 2;
  user = { ...user, permissions: [], credential_id: "read-only" };
  rerender();
  expect(result.current.canStart).toBe(false);
});

it("does not request a contract while the backend requires MFA enrollment", () => {
  user = { ...user, mfa_enrollment_required: true };
  const { result } = renderHook(() => useAccess());
  expect(loadAccessSchema).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  expect(result.current.can("start_server", "Alpha")).toBe(false);
});
