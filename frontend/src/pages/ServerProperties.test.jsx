vi.mock("../contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: vi.fn().mockResolvedValue(true) }),
}));
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { username: "admin" } }),
}));
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import ServerProperties from "./ServerProperties";
import * as api from "../test/httpFixtures";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "../contexts/ToastContext";
import { ServerContext } from "../contexts/ServerContext";

// Mock the useServer hook
vi.mock("../contexts/ServerContext", () => ({
  useServer: vi.fn(),
  ServerProvider: ({ children }) => <div>{children}</div>,
}));

import { useServer } from "../contexts/ServerContext";

// Mock API
vi.mock("../api/transport", async (importOriginal) => {
  const { createHttpTransport, configureHttpFixtures } =
    await import("../test/httpFixtures");
  const fixtures = {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  };
  configureHttpFixtures(fixtures);
  return createHttpTransport(await importOriginal());
});

const renderWithProviders = (ui) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>{ui}</ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

describe("ServerProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Mock useServer return value
    useServer.mockReturnValue({
      selectedServer: "TestServer",
      servers: [{ name: "TestServer", status: "stopped" }],
    });

    // Mock API responses
    api.get.mockImplementation((url) => {
      if (url.includes("/properties/get")) {
        return Promise.resolve({
          status: "success",
          properties: {
            "server-name": "My Server",
            "max-players": "10",
            "allow-cheats": "false",
          },
        });
      }
      return Promise.resolve({});
    });

    api.post.mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("loads raw properties only when the read-only viewer opens", async () => {
    const user = userEvent.setup();
    api.get.mockImplementation((url) => {
      if (url.endsWith("/properties/raw"))
        return Promise.resolve({
          raw_content: "# Raw document\nserver-name=Raw server\n",
        });
      return Promise.resolve({
        properties: { "server-name": "My Server" },
        raw_content: "Do not use the structured response",
      });
    });
    renderWithProviders(<ServerProperties />);
    await screen.findByDisplayValue("My Server");
    expect(
      api.get.mock.calls.some(([url]) => url.endsWith("/properties/raw")),
    ).toBe(false);
    await user.click(screen.getAllByTitle("View Properties File")[0]);
    await screen.findByText("# Raw document");
    expect(api.get).toHaveBeenCalledWith(
      "/api/server/TestServer/properties/raw",
      expect.anything(),
    );
    expect(
      screen.queryByText("Do not use the structured response"),
    ).not.toBeInTheDocument();
  });

  it("renders properties form and saves changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ServerProperties />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("My Server")).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue("My Server");

    // Clear and type new name
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    expect(nameInput).toHaveValue("New Name");

    // Find Save Changes button
    const saveButtons = screen.getAllByText("Save Changes");
    const saveButton = saveButtons[0];

    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining("/properties/set"),
        expect.objectContaining({
          properties: expect.objectContaining({
            "server-name": "New Name",
          }),
        }),
      );
    });
  });
});
