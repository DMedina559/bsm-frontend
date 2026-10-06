import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { it, expect, vi, beforeEach } from "vitest";
import { ServerProvider, useServer } from "./ServerContext";
import { request } from "./api";
const state = vi.hoisted(() => ({
  user: { username: "admin" },
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  listener: null,
  addMessageListener: vi.fn(),
}));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("./WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: false,
    isFallback: false,
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe,
    addMessageListener: state.addMessageListener,
  }),
}));
vi.mock("./api", () => ({ request: vi.fn() }));
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
      <span data-testid="servers">{servers.map((s) => s.name).join(",")}</span>
      <span data-testid="selection">{selectedServer || "none"}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={() => refreshServers()}>Refresh</button>
      <button onClick={() => setSelectedServer("First")}>Select</button>
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  state.user = { username: "admin" };
  state.addMessageListener.mockImplementation((callback) => {
    state.listener = callback;
    return () => {};
  });
});
it("changing selection does not refetch the fleet", async () => {
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "First" }, { name: "Second" }],
  });
  localStorage.setItem("selectedServer", "Second");
  render(
    <ServerProvider>
      <Harness />
    </ServerProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("selection")).toHaveTextContent("Second"),
  );
  fireEvent.click(screen.getByText("Select"));
  expect(screen.getByTestId("selection")).toHaveTextContent("First");
  expect(request).toHaveBeenCalledTimes(1);
});
it("does not restore a previous user's fleet after logout", async () => {
  let finish;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender } = render(
    <ServerProvider>
      <Harness />
    </ServerProvider>,
  );
  state.user = null;
  rerender(
    <ServerProvider>
      <Harness />
    </ServerProvider>,
  );
  await act(async () =>
    finish({ status: "success", servers: [{ name: "Private server" }] }),
  );
  expect(screen.getByTestId("servers")).toBeEmptyDOMElement();
});

it("clears foreground loading when a newer background event refresh wins", async () => {
  request.mockResolvedValue({
    status: "success",
    servers: [{ name: "First" }],
  });
  render(
    <ServerProvider>
      <Harness />
    </ServerProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("loading")).toHaveTextContent("false"),
  );
  let finishForeground, finishBackground;
  request
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishForeground = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishBackground = resolve;
        }),
    );
  fireEvent.click(screen.getByText("Refresh"));
  expect(screen.getByTestId("loading")).toHaveTextContent("true");
  act(() => state.listener({ topic: "event:after_server_stop" }));
  await act(async () =>
    finishBackground({ status: "success", servers: [{ name: "Updated" }] }),
  );
  expect(screen.getByTestId("loading")).toHaveTextContent("false");
  expect(screen.getByTestId("servers")).toHaveTextContent("Updated");
  await act(async () =>
    finishForeground({ status: "success", servers: [{ name: "Old" }] }),
  );
  expect(screen.getByTestId("servers")).toHaveTextContent("Updated");
});
