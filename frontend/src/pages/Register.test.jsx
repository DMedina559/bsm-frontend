import { render, screen, waitFor } from "../test/utils";
import Register from "./Register";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Routes, Route } from "react-router-dom";

vi.mock("../api");

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates token on mount and renders form", async () => {
    // Mock validation via api.get
    const api = await import("../api");
    api.get.mockImplementation(async (url) => {
      if (url.includes("/api/setup/status")) {
        return { needs_setup: false };
      }
      if (url.includes("/api/register/validate/valid-token")) {
        return { status: "success" };
      }
      throw new Error("Invalid route");
    });

    window.history.pushState({}, "Test", "/api/register/valid-token");

    render(
      <Routes>
        <Route path="/api/register/:token" element={<Register />} />
      </Routes>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Register" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("shows error for invalid token", async () => {
    const api = await import("../api");
    api.get.mockImplementation(async (url) => {
      if (url.includes("/api/setup/status")) {
        return { needs_setup: false };
      }
      if (url.includes("/api/register/validate/invalid-token")) {
        throw new Error("Invalid link");
      }
      return {};
    });

    window.history.pushState({}, "Test", "/api/register/invalid-token");

    render(
      <Routes>
        <Route path="/api/register/:token" element={<Register />} />
      </Routes>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Invalid or expired registration link."),
      ).toBeInTheDocument();
    });
  });
});
