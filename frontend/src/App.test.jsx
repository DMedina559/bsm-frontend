import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import { BrowserRouter } from "react-router-dom";

// Mock the API module
vi.mock("./api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  request: vi.fn(),
  getApiBaseUrl: vi.fn(),
  getJwtToken: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders loading state initially", async () => {
    // Return an unresolved promise for api.get so it stays in loading state
    const api = await import("./api");
    api.get.mockImplementation(() => new Promise(() => {}));

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    // It should show "Loading..."
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to setup if setup is needed", async () => {
    // Mock setup status via the api.get mock
    const api = await import("./api");
    api.get.mockImplementation(async (url) => {
      if (url === "/api/setup/status") {
        return { needs_setup: true };
      }
      return {};
    });

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    await waitFor(() => {
      // App redirects to /setup, Setup component renders
      // Setup component has "Setup Bedrock Server Manager"
      expect(
        screen.getByText("Setup Bedrock Server Manager"),
      ).toBeInTheDocument();
    });
  });
});
