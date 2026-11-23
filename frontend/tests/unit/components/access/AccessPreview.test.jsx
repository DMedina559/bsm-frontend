import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import AccessPreview from "../../../../src/components/access/AccessPreview";
import AccessPolicy from "../../../../src/features/api-explorer/AccessPolicy";
import { callOperation } from "../../../../src/api/operations";
const auth = vi.hoisted(() => ({ username: "owner", generation: 1 }));
vi.mock("../../../../src/api/operations", () => ({ callOperation: vi.fn() }));
vi.mock("../../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: auth.username },
    sessionGeneration: auth.generation,
  }),
}));
const result = {
  requested_permissions: ["servers:read", "settings:manage"],
  effective_permissions: ["servers:read"],
  unavailable_permissions: ["settings:manage"],
  server_permissions: {},
  policy_revision: "policy-one",
};
const body = { name: "Integration", permissions: result.requested_permissions };
beforeEach(() => {
  vi.clearAllMocks();
  auth.username = "owner";
  auth.generation = 1;
  callOperation.mockResolvedValue(result);
});
it("explains effective and unavailable capabilities without creating a credential", async () => {
  render(<AccessPreview operation="preview_integration_token" body={body} />);
  expect(
    await screen.findByText(
      "Unavailable under the current role or server limits",
    ),
  ).toBeVisible();
  expect(screen.getByText("settings:manage")).toBeVisible();
  expect(screen.getByText("policy-one")).toBeVisible();
  expect(callOperation).toHaveBeenCalledWith(
    "preview_integration_token",
    expect.objectContaining({ body, signal: expect.any(AbortSignal) }),
  );
  expect(
    callOperation.mock.calls.every(
      ([operation]) => operation === "preview_integration_token",
    ),
  ).toBe(true);
});
it("aborts stale account previews and never renders their late result", async () => {
  let resolveFirst;
  let oldSignal;
  callOperation
    .mockImplementationOnce((_, options) => {
      oldSignal = options.signal;
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    })
    .mockResolvedValue({ ...result, policy_revision: "new-owner-policy" });
  const view = render(
    <AccessPreview operation="preview_integration_token" body={body} />,
  );
  await waitFor(() => expect(callOperation).toHaveBeenCalledTimes(1));
  auth.username = "new-owner";
  auth.generation = 2;
  view.rerender(
    <AccessPreview operation="preview_integration_token" body={body} />,
  );
  await screen.findByText("new-owner-policy");
  await act(async () => {
    resolveFirst({ ...result, policy_revision: "old-owner-secret-policy" });
  });
  expect(oldSignal.aborted).toBe(true);
  expect(screen.queryByText("old-owner-secret-policy")).toBeNull();
});
it("allows an explicit retry after a preview failure", async () => {
  callOperation
    .mockRejectedValueOnce(new Error("Verification required"))
    .mockResolvedValue(result);
  render(<AccessPreview operation="preview_integration_token" body={body} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry preview" }));
  await screen.findByText("policy-one");
  expect(callOperation).toHaveBeenCalledTimes(2);
});
it("renders conditional credential alternatives instead of an undeclared flat requirement", () => {
  render(
    <AccessPolicy
      connected
      permissions={["servers:logs"]}
      policy={{
        classification: "custom",
        required_permissions: [],
        credential_alternatives: [
          {
            condition: "Server log",
            schemes: ["IntegrationToken"],
            permissions: ["servers:logs"],
          },
          {
            condition: "Application log",
            schemes: ["OAuth2PasswordBearer"],
            permissions: ["application:logs"],
          },
          {
            condition: "Local supervisor",
            schemes: ["LocalReadiness"],
            permissions: [],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("Server log")).toBeVisible();
  expect(screen.getByText("Application log")).toBeVisible();
  expect(screen.getByText("application:logs")).toBeVisible();
  expect(
    screen.getByText(
      "Dedicated local credential; account capabilities do not apply.",
    ),
  ).toBeVisible();
  expect(screen.queryByText("Not declared")).toBeNull();
});
