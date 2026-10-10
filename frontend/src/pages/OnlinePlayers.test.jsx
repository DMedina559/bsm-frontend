import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../app/queryClient";
import { synchronizeServerEvent } from "../app/applicationState";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OnlinePlayers from "./OnlinePlayers";
import { ServerProvider } from "../ServerContext";
import { ToastProvider } from "../ToastContext";
import { AuthProvider } from "../AuthContext";
import { MemoryRouter } from "react-router-dom";
import * as api from "../test/httpFixtures";

// Mock the API calls
vi.mock("../api", async (importOriginal) => {
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

// Mock logger to avoid console spam during tests
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const socket = vi.hoisted(() => ({
  connected: true,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  listeners: new Set(),
  addMessageListener: vi.fn(),
}));
vi.mock("../WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: socket.connected,
    isFallback: false,
    subscribe: socket.subscribe,
    unsubscribe: socket.unsubscribe,
    addMessageListener: socket.addMessageListener,
  }),
}));

// Create a wrapper with necessary providers
const renderWithProviders = (ui, { initialRoute = "/" } = {}) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <ToastProvider>
            <ServerProvider>{ui}</ServerProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("OnlinePlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    localStorage.clear();
    socket.connected = true;
    socket.listeners.clear();
    socket.addMessageListener.mockImplementation((listener) => {
      socket.listeners.add(listener);
      return () => socket.listeners.delete(listener);
    });

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
          username: "testuser",
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
                { name: "PlayerOne", xuid: "123" },
                { name: "PlayerTwo", xuid: "456" },
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

function emitPlayers(server_name, players) {
  act(() =>
    synchronizeServerEvent({
      type: "event",
      topic: "event:after_server_players_change",
      data: { result: { server_name, players, player_count: players.length } },
    }),
  );
}

it("updates joins, same-count replacements and the last departure", async () => {
  localStorage.setItem("selectedServer", "TestServer");
  socket.connected = true;
  socket.listeners.clear();
  socket.addMessageListener.mockImplementation((listener) => {
    socket.listeners.add(listener);
    return () => socket.listeners.delete(listener);
  });
  api.request.mockImplementation((url) =>
    Promise.resolve(
      url === "/api/account"
        ? { username: "admin", role: "admin" }
        : url === "/api/servers"
          ? {
              status: "success",
              servers: [{ name: "TestServer", players: [] }],
            }
          : { needs_setup: false },
    ),
  );
  const { unmount } = renderWithProviders(<OnlinePlayers />);
  await waitFor(() => expect(screen.getByText("0 Online")).toBeInTheDocument());
  const requests = api.request.mock.calls.length;
  emitPlayers("TestServer", [{ name: "Joined", xuid: "999" }]);
  await waitFor(() => expect(screen.getByText("Joined")).toBeInTheDocument());
  expect(screen.getByText("XUID: 999")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ban" })).toBeEnabled();
  emitPlayers("OtherServer", []);
  await waitFor(() => expect(screen.getByText("Joined")).toBeInTheDocument());
  emitPlayers("TestServer", [{ name: "Replacement", xuid: "888" }]);
  await waitFor(() =>
    expect(screen.queryByText("Joined")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Replacement")).toBeInTheDocument();
  emitPlayers("TestServer", []);
  await waitFor(() => expect(screen.getByText("0 Online")).toBeInTheDocument());
  expect(screen.queryByText("Replacement")).not.toBeInTheDocument();
  expect(api.request.mock.calls.length).toBe(requests);
  unmount();
  expect(socket.listeners.size).toBe(0);
});
