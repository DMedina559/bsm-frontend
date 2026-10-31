import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DialogProvider } from "../../../../src/contexts/DialogContext";
import AccountSecurity from "../../../../src/components/access/AccountSecurity";
import SecurityVerification from "../../../../src/components/access/SecurityVerification";
import { queryClient } from "../../../../src/app/queryClient";
import { callOperation } from "../../../../src/api/operations";
const authPolicy = vi.hoisted(() => ({ required: false }));
vi.mock("../../../../src/api/operations", () => ({ callOperation: vi.fn() }));
vi.mock("../../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      mfa_enrollment_required: authPolicy.required,
      id: 1,
      username: "admin",
      role: "admin",
      permissions: [
        "sessions:manage",
        "tokens:manage",
        "servers:read",
        "account:read",
      ],
      session_id: "current",
      server_access: "assigned",
    },
    sessionGeneration: 1,
    logout: vi.fn(),
  }),
}));
vi.mock("../../../../src/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));
let enabled;
beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  enabled = false;
  authPolicy.required = false;
  callOperation.mockImplementation(async (id) => {
    if (id === "get_account_security")
      return {
        enabled,
        recovery_codes_remaining: enabled ? 10 : 0,
        idle_timeout_seconds: 3600,
        max_session_days: 28,
      };
    if (id === "list_login_sessions")
      return [
        {
          id: "current",
          name: "Firefox · Linux",
          current: true,
          active: true,
          created_at: 100,
          last_seen_at: 200,
          expires_at: 400,
          revoked_at: null,
          user_agent: "Firefox",
          ip_address: "127.0.0.1",
          connected: true,
        },
      ];
    if (id === "list_access_servers")
      return [{ id: "alpha", name: "Alpha", permissions: ["servers:read"] }];
    if (id === "enroll_account_mfa")
      return {
        secret: "synthetic-one-time-setup-key",
        qr_svg: "data:image/svg+xml;base64,PHN2Zy8+",
        provisioning_uri: "otpauth://totp/test",
      };
    if (id === "confirm_account_mfa") {
      enabled = true;
      return { recovery_codes: ["synthetic-recovery-code"] };
    }
    if (id === "verify_account_security") return { verified_until: 999 };
    return [];
  });
});
const show = () =>
  render(
    <DialogProvider>
      <AccountSecurity>
        <p>Password panel</p>
      </AccountSecurity>
      <SecurityVerification />
    </DialogProvider>,
  );

it("shows current-session metadata and keeps bulk session revocation separate from credentials", async () => {
  show();
  await screen.findByText("Firefox · Linux");
  expect(screen.getByText("This session")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Sign out other sessions" }),
  );
  expect(
    screen.getByText(/Integration credentials will keep working/),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Continue", exact: true }),
  );
  await waitFor(() =>
    expect(callOperation).toHaveBeenCalledWith(
      "revoke_login_sessions",
      expect.objectContaining({ body: { mode: "others" } }),
    ),
  );
  expect(
    callOperation.mock.calls.some(
      ([id]) => id === "revoke_all_integration_tokens",
    ),
  ).toBe(false);
});

it("keeps enrollment and recovery material out of query and mutation caches", async () => {
  show();
  fireEvent.click(screen.getByRole("tab", { name: "Password & MFA" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Set up authenticator" }),
  );
  expect(
    await screen.findByDisplayValue("synthetic-one-time-setup-key"),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Six-digit authenticator code"), {
    target: { value: "123456" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enable two-factor authentication" }),
  );
  expect(
    await screen.findByText("synthetic-recovery-code"),
  ).toBeInTheDocument();
  const cache = JSON.stringify({
    queries: queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data),
    mutations: queryClient.getMutationCache().getAll(),
  });
  expect(cache).not.toContain("synthetic-one-time-setup-key");
  expect(cache).not.toContain("synthetic-recovery-code");
  fireEvent.click(screen.getByRole("button", { name: "I saved my codes" }));
  expect(screen.queryByText("synthetic-recovery-code")).not.toBeInTheDocument();
});

it("explains capability restrictions and supports recent verification without caching the password", async () => {
  show();
  fireEvent.click(screen.getByRole("tab", { name: "My access" }));
  fireEvent.change(screen.getByLabelText("Check a permission"), {
    target: { value: "servers:control" },
  });
  expect(
    screen.getByText(/does not include this permission/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Verify password" }));
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "synthetic-private-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify identity" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(JSON.stringify(queryClient.getMutationCache().getAll())).not.toContain(
    "synthetic-private-password",
  );
});

it("opens MFA enrollment immediately when administrator policy requires it", async () => {
  authPolicy.required = true;
  show();
  expect(
    await screen.findByRole("button", { name: "Set up authenticator" }),
  ).toBeVisible();
  expect(screen.getByRole("tab", { name: "Password & MFA" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.queryByText("Password panel")).not.toBeInTheDocument();
});
