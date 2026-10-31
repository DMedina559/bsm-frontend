import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DialogProvider } from "../../../../src/contexts/DialogContext";
import IntegrationTokens from "../../../../src/components/access/IntegrationTokens";
import ServerAccessEditor from "../../../../src/components/access/ServerAccessEditor";
import { queryClient } from "../../../../src/app/queryClient";
import { callOperation } from "../../../../src/api/operations";
vi.mock("../../../../src/api/operations", () => ({ callOperation: vi.fn() }));
vi.mock("../../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "admin", role: "admin" },
    sessionGeneration: 1,
  }),
}));
const identity = "a".repeat(32);
const capabilities = [
  "account:read",
  "health:read",
  "servers:read",
  "tasks:read",
  "servers:control",
];
const catalog = {
  revision: "one",
  permissions: Object.fromEntries(capabilities.map((value) => [value, value])),
  token_permissions: capabilities,
  server_permissions: ["servers:read", "servers:control", "servers:manage"],
  role_permissions: { moderator: ["servers:read", "servers:control"] },
};
beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  callOperation.mockImplementation(async (id) => {
    if (id === "get_access_policy") return catalog;
    if (id === "list_access_servers")
      return [{ id: identity, name: "Alpha", permissions: capabilities }];
    if (id === "list_integration_tokens") return [];
    if (id === "get_account_server_access") return { mode: "all", grants: [] };
    if (id === "create_integration_token")
      return { token: "bsm_it_one-time-secret", credential: { id: identity } };
    return { status: "success" };
  });
});
it("shows a new credential once without retaining its secret in query or mutation caches", async () => {
  render(
    <DialogProvider>
      <IntegrationTokens />
    </DialogProvider>,
  );
  await screen.findByLabelText("Credential name");
  fireEvent.change(screen.getByLabelText("Credential name"), {
    target: { value: "Home Assistant" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create credential" }));
  const secret = await screen.findByLabelText("New integration credential");
  expect(secret.value).toBe("bsm_it_one-time-secret");
  expect(
    JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    ),
  ).not.toContain("bsm_it_one-time-secret");
  expect(JSON.stringify(queryClient.getMutationCache().getAll())).not.toContain(
    "bsm_it_one-time-secret",
  );
  fireEvent.click(screen.getByRole("button", { name: "Dismiss credential" }));
  expect(screen.queryByLabelText("New integration credential")).toBeNull();
});
it("edits server grants using immutable resource IDs and the selected account's role ceiling", async () => {
  render(<ServerAccessEditor userId={2} userRole="moderator" />);
  const mode = await screen.findByLabelText("Access mode");
  fireEvent.change(mode, { target: { value: "assigned" } });
  fireEvent.click(screen.getByText(/Alpha ·/));
  expect(screen.queryByLabelText("servers:manage")).toBeNull();
  fireEvent.click(screen.getByLabelText("servers:control"));
  fireEvent.click(screen.getByRole("button", { name: "Save server access" }));
  await waitFor(() =>
    expect(callOperation).toHaveBeenCalledWith(
      "set_account_server_access",
      expect.objectContaining({
        path: { user_id: 2 },
        body: {
          mode: "assigned",
          grants: [
            {
              server_id: identity,
              permissions: ["servers:read", "servers:control"],
            },
          ],
        },
      }),
    ),
  );
  expect(await screen.findByText("Server access saved.")).toBeInTheDocument();
});

it("creates a non-expiring credential only when explicitly selected", async () => {
  render(
    <DialogProvider>
      <IntegrationTokens />
    </DialogProvider>,
  );
  await screen.findByLabelText("Credential name");
  const duration = screen.getByLabelText("Expires after days");
  expect(duration.value).toBe("30");
  fireEvent.change(screen.getByLabelText("Credential name"), {
    target: { value: "Permanent integration" },
  });
  fireEvent.click(screen.getByLabelText("Never expire"));
  expect(duration).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Create credential" }));
  await waitFor(() =>
    expect(callOperation).toHaveBeenCalledWith(
      "create_integration_token",
      expect.objectContaining({
        body: expect.objectContaining({ expires_in_days: null }),
      }),
    ),
  );
});

it("shows non-expiring credentials as active and keeps rotation available", async () => {
  const original = callOperation.getMockImplementation();
  callOperation.mockImplementation((id, ...args) =>
    id === "list_integration_tokens"
      ? Promise.resolve([
          {
            id: identity,
            name: "Persistent monitor",
            expires_at: null,
            revoked_at: null,
            permissions: ["account:read"],
            server_ids: null,
          },
        ])
      : original(id, ...args),
  );
  render(
    <DialogProvider>
      <IntegrationTokens />
    </DialogProvider>,
  );
  expect(await screen.findByText("Never expires")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Rotate Persistent monitor" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Revoke Persistent monitor" }),
  ).toBeVisible();
});
