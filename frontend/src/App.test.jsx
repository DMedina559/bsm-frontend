import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import { BrowserRouter } from "react-router-dom";

// Mock the API module
vi.mock("./api", async (importOriginal) => {
  const { createHttpTransport, configureHttpFixtures } =
    await import("./test/httpFixtures");
  const fixtures = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    request: vi.fn(),
    getApiBaseUrl: vi.fn(),
    getJwtToken: vi.fn(),
  };
  configureHttpFixtures(fixtures);
  return createHttpTransport(await importOriginal());
});

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders loading state initially", async () => {
    // Return an unresolved promise for api.get so it stays in loading state
    const api = await import("./test/httpFixtures");
    api.get.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>,
      );
    });

    // It should show "Loading..."
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to setup if setup is needed", async () => {
    // Mock setup status via the api.get mock
    const api = await import("./test/httpFixtures");
    api.get.mockImplementation(async (url) => {
      if (url === "/api/setup/status") {
        return { needs_setup: true };
      }
      return {};
    });

    await act(async () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>,
      );
    });

    await waitFor(() => {
      // App redirects to /setup, Setup component renders
      // Setup component has "Setup Bedrock Server Manager"
      expect(
        screen.getByText("Setup Bedrock Server Manager"),
      ).toBeInTheDocument();
    });
  });
});
it("routes setup correctly through the data router under a proxy basename", async () => {
  const { createMemoryRouter, RouterProvider } =
    await import("react-router-dom");
  const api = await import("./test/httpFixtures");
  api.get.mockImplementation(async (url) =>
    url === "/api/setup/status" ? { needs_setup: true } : {},
  );
  const router = createMemoryRouter([{ path: "*", element: <App /> }], {
    basename: "/ingress/app",
    initialEntries: ["/ingress/app/"],
  });
  const view = render(<RouterProvider router={router} />);
  await screen.findByText("Setup Bedrock Server Manager");
  expect(router.state.location.pathname).toBe("/ingress/app/setup");
  view.unmount();
  router.dispose();
});
