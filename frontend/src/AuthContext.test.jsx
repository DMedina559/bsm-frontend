import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import * as api from "./api";

// Mock api
vi.mock("./api", () => ({
  get: vi.fn(),
  request: vi.fn(),
}));

const TestComponent = () => {
  const { user, login, logout, loading, needsSetup } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (needsSetup) return <div>Needs Setup</div>;
  if (user)
    return (
      <div>
        User: {user.username}
        <button onClick={() => logout()}>Logout</button>
      </div>
    );

  return (
    <div>
      No User
      <button onClick={() => login("testuser", "password", true)}>Login</button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("handles needs_setup true", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: true });

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    expect(screen.getByText("Needs Setup")).toBeInTheDocument();
  });

  it("handles user already authenticated", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    api.request.mockResolvedValueOnce({ username: "testuser" });

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    expect(screen.getByText("User: testuser")).toBeInTheDocument();
  });

  it("handles user unauthenticated", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    const error = new Error("Unauthorized");
    error.status = 401;
    api.request.mockRejectedValueOnce(error);

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    expect(screen.getByText("No User")).toBeInTheDocument();
  });

  it("handles generic error on checkUser", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    const error = new Error("Network Error");
    api.request.mockRejectedValueOnce(error);

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    expect(screen.getByText("No User")).toBeInTheDocument();
  });

  it("handles setup error gracefully", async () => {
    api.get.mockRejectedValueOnce(new Error("Network Error"));
    api.request.mockResolvedValueOnce({ username: "testuser" });

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    expect(screen.getByText("User: testuser")).toBeInTheDocument();
  });

  it("handles login successfully", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    api.request.mockRejectedValueOnce(new Error("Unauthorized")); // Initial checkUser

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    api.request.mockResolvedValueOnce({ access_token: "test_token" }); // login
    api.get.mockResolvedValueOnce({ needs_setup: false }); // checkUser setup
    api.request.mockResolvedValueOnce({ username: "testuser" }); // checkUser fetch

    await act(async () => {
      screen.getByText("Login").click();
    });

    expect(localStorage.getItem("access_token")).toBe("test_token");
    expect(screen.getByText("User: testuser")).toBeInTheDocument();
  });

  it("handles login failure without token", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    api.request.mockRejectedValueOnce(new Error("Unauthorized")); // Initial checkUser

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    api.request.mockResolvedValueOnce({ success: false }); // login (no token)
    api.get.mockResolvedValueOnce({ needs_setup: false }); // checkUser setup
    api.request.mockRejectedValueOnce(new Error("Unauthorized")); // checkUser fetch

    await act(async () => {
      screen.getByText("Login").click();
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(screen.getByText("No User")).toBeInTheDocument();
  });

  it("handles logout successfully", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    api.request.mockResolvedValueOnce({ username: "testuser" });

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    localStorage.setItem("access_token", "test_token");
    expect(screen.getByText("User: testuser")).toBeInTheDocument();

    api.request.mockResolvedValueOnce({}); // logout

    await act(async () => {
      screen.getByText("Logout").click();
    });

    expect(localStorage.getItem("access_token")).toBeNull();
    expect(screen.getByText("No User")).toBeInTheDocument();
  });

  it("handles logout failure gracefully", async () => {
    api.get.mockResolvedValueOnce({ needs_setup: false });
    api.request.mockResolvedValueOnce({ username: "testuser" });

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>,
      );
    });

    localStorage.setItem("access_token", "test_token");

    api.request.mockRejectedValueOnce(new Error("Network Error")); // logout failure

    await act(async () => {
      screen.getByText("Logout").click();
    });

    // Even if server request fails, local token should be removed and user set to null
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(screen.getByText("No User")).toBeInTheDocument();
  });
});
