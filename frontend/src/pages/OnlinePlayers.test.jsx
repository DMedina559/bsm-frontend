import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OnlinePlayers from "./OnlinePlayers";
import { ServerProvider } from "../ServerContext";
import { ToastProvider } from "../ToastContext";
import { AuthProvider } from "../AuthContext";
import { MemoryRouter } from "react-router-dom";
import * as api from "../api";

// Mock the API calls
vi.mock("../api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}));

// Mock logger to avoid console spam during tests
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: true,
    isFallback: false,
    lastMessage: null,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    addMessageListener: vi.fn(() => vi.fn()),
  }),
}));

// Create a wrapper with necessary providers
const renderWithProviders = (ui, { initialRoute = "/" } = {}) => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <ToastProvider>
          <ServerProvider>{ui}</ServerProvider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
};

describe("OnlinePlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock user so ServerProvider will fetch servers
    api.request.mockImplementation((url) => {
      if (url === "/api/setup/status") {
        return Promise.resolve({
          status: "success",
          data: { needs_setup: false },
        });
      }
      if (url === "/api/account") {
        return Promise.resolve({
          status: "success",
          data: { user: { username: "testuser" } },
        });
      }
      if (url === "/api/servers") {
        return Promise.resolve({
          status: "success",
          servers: [
            {
              name: "TestServer",
              status: "running",
              player_count: 2,
              players: [
                { name: "PlayerOne", uuid: "123" },
                { name: "PlayerTwo", uuid: "456" },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });
  });

  it("renders online players list", async () => {
    localStorage.setItem("selectedServer", "TestServer");
    renderWithProviders(<OnlinePlayers />);

    // Wait for the servers to load and players to be displayed
    await waitFor(() => {
      expect(screen.getByText("PlayerOne")).toBeInTheDocument();
      expect(screen.getByText("PlayerTwo")).toBeInTheDocument();
    });
  });
});
