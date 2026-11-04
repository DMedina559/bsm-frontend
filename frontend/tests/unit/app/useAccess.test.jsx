/** @vitest-environment jsdom */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAccess, useServerAccess } from "../../../src/app/useAccess";
import { ACTIONS, PERMISSIONS } from "../../../src/app/permissions";
import { queryClient } from "../../../src/app/queryClient";
import { callOperation } from "../../../src/api/operations";

vi.mock("../../../src/api/operations", () => ({
  callOperation: vi.fn(),
}));

let mockUser = {
  id: 1,
  username: "testuser",
  role: "moderator",
  server_access: "all",
  permissions: ["servers:read", "servers:lifecycle", "servers:command"],
};

vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    sessionGeneration: 1,
  }),
}));

describe("useAccess with dynamic policy discovery", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    mockUser = {
      id: 1,
      username: "testuser",
      role: "moderator",
      server_access: "all",
      permissions: ["servers:read", "servers:lifecycle", "servers:command"],
    };
  });

  it("resolves dynamic scope names from backend get_access_policy", async () => {
    callOperation.mockImplementation(async (op) => {
      if (op === "get_access_policy") {
        return {
          revision: "rev-1",
          permissions: {
            "servers:lifecycle": "Start, stop and restart game servers",
            "servers:command":
              "Send interactive console commands to running servers",
            "servers:read": "List visible servers",
          },
        };
      }
      return {};
    });

    const { result } = renderHook(() => useAccess());

    await waitFor(() => expect(result.current.policy).toBeDefined());

    // Checks using semantic action keys
    expect(result.current.can(ACTIONS.SERVER_LIFECYCLE)).toBe(true);
    expect(result.current.can(ACTIONS.SERVER_COMMAND)).toBe(true);
    expect(result.current.can(ACTIONS.SERVER_INSTALL)).toBe(false);

    // Checks using new direct permission names
    expect(result.current.can(PERMISSIONS.SERVERS_LIFECYCLE)).toBe(true);
    expect(result.current.can(PERMISSIONS.SERVERS_COMMAND)).toBe(true);
  });

  it("denies access when user does not hold the required permission", async () => {
    mockUser.permissions = ["servers:read"];

    callOperation.mockImplementation(async (op) => {
      if (op === "get_access_policy") {
        return {
          revision: "rev-2",
          permissions: {
            "servers:lifecycle": "Start, stop and restart game servers",
            "servers:command":
              "Send interactive console commands to running servers",
            "servers:read": "List visible servers",
          },
        };
      }
      return {};
    });

    const { result } = renderHook(() => useAccess());

    await waitFor(() => expect(result.current.policy).toBeDefined());

    expect(result.current.can(ACTIONS.SERVER_LIFECYCLE)).toBe(false);
    expect(result.current.can(ACTIONS.SERVER_COMMAND)).toBe(false);
    expect(result.current.can(ACTIONS.SERVER_READ)).toBe(true);
  });

  it("evaluates useServerAccess capabilities accurately", async () => {
    mockUser.permissions = [
      "servers:read",
      "servers:lifecycle",
      "properties:manage",
    ];

    callOperation.mockImplementation(async (op) => {
      if (op === "get_access_policy") {
        return {
          revision: "rev-2",
          permissions: {
            "servers:lifecycle": "Start, stop and restart game servers",
            "properties:manage": "Edit properties",
          },
        };
      }
      return {};
    });

    const { result } = renderHook(() => useServerAccess("Survival"));

    await waitFor(() => expect(result.current.policy).toBeDefined());

    expect(result.current.canLifecycle).toBe(true);
    expect(result.current.canCommand).toBe(false);
    expect(result.current.canUpdate).toBe(false);
    expect(result.current.canProperties).toBe(true);
    expect(result.current.canReadProperties).toBe(true);
  });

  it("respects per-server assigned access", async () => {
    mockUser.server_access = "assigned";
    mockUser.permissions = [
      "servers:read",
      "servers:lifecycle",
      "servers:command",
    ];

    callOperation.mockImplementation(async (op) => {
      if (op === "get_access_policy") {
        return {
          revision: "rev-3",
          permissions: {
            "servers:lifecycle": "Lifecycle",
            "servers:command": "Command",
            "servers:read": "Read",
          },
        };
      }
      if (op === "list_access_servers") {
        return [
          {
            id: "server-1",
            name: "Alpha",
            permissions: ["servers:read", "servers:lifecycle"],
          },
          {
            id: "server-2",
            name: "Beta",
            permissions: ["servers:read"],
          },
        ];
      }
      return {};
    });

    const { result: alpha } = renderHook(() => useServerAccess("Alpha"));
    const { result: beta } = renderHook(() => useServerAccess("Beta"));

    await waitFor(() => expect(alpha.current.resources).toBeDefined());

    expect(alpha.current.canLifecycle).toBe(true);
    expect(alpha.current.canCommand).toBe(false);

    expect(beta.current.canLifecycle).toBe(false);
    expect(beta.current.canCommand).toBe(false);
  });
});
