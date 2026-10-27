import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../src/App";
import { BrowserRouter } from "react-router-dom";

const failures = vi.hoisted(() => ({ provider: false }));
vi.mock("../../src/contexts/WebSocketContext", async (original) => {
  const actual = await original();
  return {
    ...actual,
    WebSocketProvider: ({ children }) => {
      if (failures.provider) throw new Error("Socket provider unavailable");
      return <actual.WebSocketProvider>{children}</actual.WebSocketProvider>;
    },
  };
});

// Mock the API module
vi.mock("../../src/api/transport", async (importOriginal) => {
  const { createHttpTransport, configureHttpFixtures } =
    await import("../support/httpFixtures");
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
    const api = await import("../support/httpFixtures");
    api.get.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>,
      );
    });

    // It should show "Loading..."
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to setup if setup is needed", async () => {
    // Mock setup status via the api.get mock
    const api = await import("../support/httpFixtures");
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
  const api = await import("../support/httpFixtures");
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

it("offers recovery when an application provider fails before routes mount", () => {
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  failures.provider = true;
  try {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This workspace could not be opened",
    );
    expect(
      screen.getByRole("button", { name: "Reload interface" }),
    ).toBeVisible();
  } finally {
    failures.provider = false;
    report.mockRestore();
  }
});
