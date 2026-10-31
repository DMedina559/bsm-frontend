import { render, screen, fireEvent, waitFor } from "../../support/utils";
import Login from "../../../src/pages/Login";
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default fetch mock (success setup status)
    globalThis.fetch.mockImplementation((url) => {
      if (url === "/api/setup/status")
        return Promise.resolve({
          ok: true,
          json: async () => ({ needs_setup: false }),
        });
      if (url === "/api/account") return Promise.reject({ status: 401 }); // Initially not logged in
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it("renders login form", async () => {
    render(<Login />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Username/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Authenticator or recovery code/i),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Sign In/i }),
    ).toBeInTheDocument();
  });

  it("handles successful login", async () => {
    // Mock successful login response
    globalThis.fetch.mockImplementation((url) => {
      if (url === "/api/setup/status")
        return Promise.resolve({
          ok: true,
          json: async () => ({ needs_setup: false }),
        });
      // After login, checkUser is called which calls /api/account
      if (url === "/api/account")
        return Promise.resolve({
          ok: true,
          json: async () => ({ username: "testuser" }),
        }); // Use fetch response structure because request calls fetch? No request calls fetch.
      // Wait, api.js request calls fetch. If we mock global fetch, request uses it.
      // But /api/account should return JSON matching backend.
      // api.js expects response.json().

      if (url === "/auth/token")
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: "fake-token" }),
        });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Login />);

    fireEvent.change(screen.getByLabelText(/Username/i), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/auth/token",
        expect.anything(),
      );
    });
  });

  it("handles login failure", async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url === "/api/setup/status")
        return Promise.resolve({
          ok: true,
          json: async () => ({ needs_setup: false }),
        });
      if (url === "/api/account") return Promise.reject({ status: 401 });
      if (url === "/auth/token")
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ detail: "Invalid username or password" }),
        });
      return Promise.resolve({ ok: true });
    });

    render(<Login />);

    fireEvent.change(screen.getByLabelText(/Username/i), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid username or password"),
      ).toBeInTheDocument();
    });
  });
  it("asks for a factor only after valid credentials receive an MFA challenge", async () => {
    let attempts = 0;
    globalThis.fetch.mockImplementation((url) => {
      if (url === "/api/setup/status")
        return Promise.resolve({
          ok: true,
          json: async () => ({ needs_setup: false }),
        });
      if (url === "/api/account") return Promise.reject({ status: 401 });
      if (url === "/auth/token") {
        attempts += 1;
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({
            "content-type": "application/json",
            ...(attempts === 1 ? { "X-BSM-MFA": "required" } : {}),
          }),
          json: async () => ({
            detail:
              attempts === 1
                ? "Authenticator or recovery code required"
                : "Incorrect username or password",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<Login />);
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    const factor = await screen.findByLabelText(
      "Authenticator or recovery code",
    );
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(factor, { target: { value: "wrong-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(
      await screen.findByText(
        "Invalid verification code. Try again or use a recovery code.",
      ),
    ).toBeVisible();
    expect(factor.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(
      screen.queryByLabelText("Authenticator or recovery code"),
    ).toBeNull();
    expect(screen.getByLabelText("Password").value).toBe("");
  });
});
