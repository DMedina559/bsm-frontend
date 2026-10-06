import { render, screen, fireEvent, waitFor } from "../test/utils";
import Account from "./Account";
import { vi, describe, it, expect, beforeEach } from "vitest";
import * as api from "../api";

vi.mock("../api");

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
    api.request.mockResolvedValue({ username: "testuser", role: "admin" });

    render(<Account />);

    await waitFor(() => {
      expect(screen.getByText("My Account")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { name: "Theme" }),
    ).not.toBeInTheDocument();
  });

  it("updates password", async () => {
    api.request.mockResolvedValue({ username: "testuser", role: "admin" });
    render(<Account />);

    await waitFor(() => {
      expect(screen.getByText("My Account")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "newpass" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "newpass" },
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
