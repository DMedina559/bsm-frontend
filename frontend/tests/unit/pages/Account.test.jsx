import { accessUser } from "../../support/accessFixtures";
import { render, screen, fireEvent, waitFor } from "../../support/utils";
import Account from "../../../src/pages/Account";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../../support/httpFixtures";

vi.mock("../../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport } = await import("../../support/httpFixtures");
  return createHttpTransport(await importOriginal());
});

describe("Account", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.get.mockImplementation((url) => {
      if (url === "/api/info/themes") {
        return Promise.resolve({
          themes: ["default", "dark", "light"],
        });
      }
      return Promise.resolve({});
    });

    api.post.mockResolvedValue({ status: "success" });
  });

  it("renders account info", async () => {
    api.request.mockResolvedValue(
      accessUser("admin", {
        username: "testuser",
        permissions: ["account:manage"],
      }),
    );

    render(<Account />);

    await waitFor(() => {
      expect(screen.getByText("My Account")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { name: "Theme" }),
    ).not.toBeInTheDocument();
  });

  it("updates password", async () => {
    api.request.mockResolvedValue(
      accessUser("admin", {
        username: "testuser",
        permissions: ["account:manage"],
      }),
    );
    render(<Account />);

    await waitFor(() => {
      expect(screen.getByText("My Account")).toBeInTheDocument();
    });

    await screen.findByLabelText("New Password");
    expect(screen.getByLabelText("New Password")).toHaveAttribute(
      "minlength",
      "8",
    );
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "Otter42!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Otter42!" },
    });
    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "oldpass" },
    });

    fireEvent.click(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/account/change-password",
        expect.anything(),
      );
    });
  });
});

it("keeps required MFA enrollment reachable before runtime discovery is available", async () => {
  api.request.mockResolvedValue(
    accessUser("admin", {
      id: 1,
      username: "enrollment-admin",
      permissions: ["account:read", "sessions:manage"],
      mfa_enrollment_required: true,
    }),
  );
  render(<Account />);
  expect(
    await screen.findByText(/Your administrator requires MFA/),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Set up authenticator", exact: true }),
  ).toBeVisible();
});

it("retains one-time recovery codes while enrollment completion refreshes runtime permissions", async () => {
  let required = true;
  let completedAccountRead = false;
  api.request.mockImplementation(async (url) => {
    if (url === "/api/account") {
      if (!required) completedAccountRead = true;
      return accessUser("admin", {
        id: 1,
        username: "enrollment-admin",
        permissions: ["account:read", "sessions:manage"],
        policy_revision: required ? "enrolling" : "complete",
        mfa_enrollment_required: required,
      });
    }
    return { status: "success" };
  });
  api.get.mockImplementation(async (url) =>
    url === "/api/setup/status"
      ? { needs_setup: false }
      : url === "/api/account/security"
        ? { enabled: !required }
        : [],
  );
  api.post.mockImplementation(async (url) => {
    if (url.endsWith("/mfa/enroll"))
      return {
        secret: "synthetic-setup-key",
        qr_svg: "data:image/svg+xml;base64,PHN2Zy8+",
      };
    if (url.endsWith("/mfa/confirm")) {
      required = false;
      return { recovery_codes: ["retained-recovery-code"] };
    }
    return { status: "success" };
  });
  render(<Account />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Set up authenticator",
      exact: true,
    }),
  );
  await screen.findByLabelText("Setup key");
  fireEvent.change(screen.getByLabelText("Six-digit authenticator code"), {
    target: { value: "123456" },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Enable two-factor authentication",
      exact: true,
    }),
  );
  await waitFor(() => expect(completedAccountRead).toBe(true));
  expect(await screen.findByText("retained-recovery-code")).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Save your recovery codes" }),
  ).toBeVisible();
});
