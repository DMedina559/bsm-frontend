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
  addMessageListener: () => () => {},
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
  const { servers, selectedServer, setSelectedServer } = useServer();
  return (
    <>
      <span data-testid="servers">{servers.map((s) => s.name).join(",")}</span>
      <span data-testid="selection">{selectedServer || "none"}</span>
      <button onClick={() => setSelectedServer("First")}>Select</button>
    </>
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  state.user = { username: "admin" };
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
