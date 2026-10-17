import { getPreferenceIdentity } from "../../../src/app/backendIdentity";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, beforeEach } from "vitest";
import { ServerProvider, useServer } from "../../../src/contexts/ServerContext";
import { queryClient } from "../../../src/app/queryClient";
import { synchronizeServerEvent } from "../../../src/app/applicationState";
import { sessionRuntime } from "../../../src/app/sessionRuntime";
import { createPreferenceStore } from "../../../src/app/preferenceStore";
import { request } from "../../../src/api/transport";
const state = vi.hoisted(() => ({
  user: { username: "admin" },
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  connected: false,
  confirm: vi.fn(async () => true),
}));
vi.mock("../../../src/contexts/DialogContext", () => ({
  useDialog: () => ({ confirmAction: state.confirm }),
}));
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("../../../src/contexts/WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: state.connected,
    isFallback: false,
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe,
  }),
}));
vi.mock("../../../src/api/transport", () => ({ request: vi.fn() }));
function Harness() {
  const {
    servers,
    selectedServer,
    setSelectedServer,
    loading,
    refreshServers,
  } = useServer();
  return (
    <>
      <span data-testid="players">
        {servers
          .flatMap((s) => s.players || [])
          .map((p) => p.name)
          .join(",")}
      </span>
      <span data-testid="servers">{servers.map((s) => s.name).join(",")}</span>
      <span data-testid="selection">{selectedServer || "none"}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={refreshServers}>Refresh</button>
      <button onClick={() => setSelectedServer("First")}>Select</button>
    </>
  );
}
const tree = () => (
  <QueryClientProvider client={queryClient}>
    <ServerProvider>
      <Harness />
    </ServerProvider>
  </QueryClientProvider>
);
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  queryClient.clear();
  sessionRuntime.reset();
  state.user = { username: "admin" };
  state.connected = false;
});
it("restores account selection without refetching on selection changes", async () => {
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "First" }, { name: "Second" }],
  });
  createPreferenceStore().write(
    getPreferenceIdentity({ username: "admin" }),
    "selectedServer",
    "Second",
  );
  render(tree());
  await waitFor(() =>
    expect(screen.getByTestId("selection")).toHaveTextContent("Second"),
  );
  fireEvent.click(screen.getByText("Select"));
  expect(screen.getByTestId("selection")).toHaveTextContent("First");
  expect(request).toHaveBeenCalledTimes(1);
});
it("isolates a late fleet response when the account changes", async () => {
  let finish;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender } = render(tree());
  state.user = null;
  sessionRuntime.reset();
  queryClient.clear();
  rerender(tree());
  await act(async () =>
    finish({ status: "success", servers: [{ name: "Private" }] }),
  );
  expect(screen.getByTestId("servers")).toBeEmptyDOMElement();
});
it("reconciles socket players arriving during an HTTP refresh", async () => {
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "First", players: [], player_count: 0 }],
  });
  render(tree());
  await waitFor(() =>
    expect(screen.getByTestId("servers")).toHaveTextContent("First"),
  );
  let finish;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByText("Refresh"));
  act(() =>
    synchronizeServerEvent({
      type: "event",
      topic: "event:after_server_players_change",
      data: {
        result: {
          server_name: "First",
          players: [{ name: "Joined", xuid: "123" }],
          player_count: 1,
        },
      },
    }),
  );
  await act(async () =>
    finish({
      status: "success",
      servers: [{ name: "First", players: [], player_count: 0 }],
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("players")).toHaveTextContent("Joined"),
  );
});

it("never renders another account's selection while its preferences restore", async () => {
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "First" }],
  });
  const observed = [];
  function ObserveSelection() {
    const { selectedServer } = useServer();
    observed.push({ account: state.user.username, selectedServer });
    return null;
  }
  const view = () => (
    <QueryClientProvider client={queryClient}>
      <ServerProvider>
        <Harness />
        <ObserveSelection />
      </ServerProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(view());
  await waitFor(() =>
    expect(screen.getByTestId("selection")).toHaveTextContent("First"),
  );
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "Second" }],
  });
  state.user = { username: "other" };
  rerender(view());
  await waitFor(() =>
    expect(screen.getByTestId("selection")).toHaveTextContent("Second"),
  );
  expect(
    observed
      .filter((snapshot) => snapshot.account === "other")
      .map((snapshot) => snapshot.selectedServer),
  ).not.toContain("First");
});

it("keeps the selected server when an unsaved-change confirmation is cancelled", async () => {
  const { draftRegistry } = await import("../../../src/app/draftRegistry");
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "First" }, { name: "Second" }],
  });
  createPreferenceStore().write(
    getPreferenceIdentity(state.user),
    "selectedServer",
    "Second",
  );
  render(tree());
  await waitFor(() =>
    expect(screen.getByTestId("selection")).toHaveTextContent("Second"),
  );
  const release = draftRegistry.register();
  try {
    state.confirm.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByText("Select"));
    await waitFor(() => expect(state.confirm).toHaveBeenCalledOnce());
    expect(screen.getByTestId("selection")).toHaveTextContent("Second");
    state.confirm.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByText("Select"));
    await waitFor(() =>
      expect(screen.getByTestId("selection")).toHaveTextContent("First"),
    );
  } finally {
    release();
  }
});
