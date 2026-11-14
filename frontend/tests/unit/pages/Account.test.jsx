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
