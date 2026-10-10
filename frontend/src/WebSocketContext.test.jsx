import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketProvider, useWebSocket } from "./WebSocketContext";
const auth = vi.hoisted(() => ({ user: { username: "admin" } }));
vi.mock("./AuthContext", () => ({ useAuth: () => auth }));
function Harness() {
  const { isConnected, subscribe, unsubscribe } = useWebSocket();
  return (
    <>
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
      <button onClick={() => subscribe("shared")}>Subscribe</button>
      <button onClick={() => unsubscribe("shared")}>Unsubscribe</button>
    </>
  );
}
let sockets = [];
beforeEach(() => {
  sockets = [];
  class Socket {
    static OPEN = 1;
    static CONNECTING = 0;
    constructor() {
      this.readyState = 0;
      this.send = vi.fn();
      this.close = vi.fn();
      sockets.push(this);
    }
  }
  vi.stubGlobal("WebSocket", Socket);
});
afterEach(() => vi.unstubAllGlobals());
describe("WebSocket lifecycle", () => {
  it("reports live only after authentication succeeds", () => {
    render(
      <WebSocketProvider>
        <Harness />
      </WebSocketProvider>,
    );
    const socket = sockets.at(-1);
    socket.readyState = 1;
    act(() => socket.onopen());
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    act(() =>
      socket.onmessage({
        data: JSON.stringify({
          status: "success",
          message: "Authenticated successfully",
        }),
      }),
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
  it("retains a shared topic until all subscribers release it", () => {
    render(
      <WebSocketProvider>
        <Harness />
      </WebSocketProvider>,
    );
    const socket = sockets.at(-1);
    socket.readyState = 1;
    act(() => socket.onopen());
    act(() =>
      socket.onmessage({
        data: JSON.stringify({
          status: "success",
          message: "Authenticated successfully",
        }),
      }),
    );
    socket.send.mockClear();
    fireEvent.click(screen.getByText("Subscribe"));
    fireEvent.click(screen.getByText("Subscribe"));
    fireEvent.click(screen.getByText("Unsubscribe"));
    expect(socket.send).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Unsubscribe"));
    expect(socket.send).toHaveBeenLastCalledWith(
      JSON.stringify({ action: "unsubscribe", topic: "shared" }),
    );
  });
  it("disconnects cleanly on unmount without a reconnect handler", () => {
    const { unmount } = render(
      <WebSocketProvider>
        <Harness />
      </WebSocketProvider>,
    );
    const socket = sockets.at(-1);
    unmount();
    expect(socket.close).toHaveBeenCalled();
    expect(socket.onclose).toBeNull();
  });
});
it("delivers stream messages without rerendering connection consumers", () => {
  let renders = 0;
  const received = vi.fn();
  function Consumer() {
    const { addMessageListener } = useWebSocket();
    renders++;
    React.useEffect(() => addMessageListener(received), [addMessageListener]);
    return null;
  }
  render(
    <WebSocketProvider>
      <Consumer />
    </WebSocketProvider>,
  );
  const socket = sockets.at(-1);
  act(() =>
    socket.onmessage({
      data: JSON.stringify({
        status: "success",
        message: "Authenticated successfully",
      }),
    }),
  );
  const before = renders;
  act(() => {
    for (let i = 0; i < 25; i++)
      socket.onmessage({
        data: JSON.stringify({ type: "log", topic: "logs", data: { line: i } }),
      });
  });
  expect(received).toHaveBeenCalledTimes(25);
  expect(renders).toBe(before);
});
it("owns core subscriptions and refreshes resources on authenticated reconnect", async () => {
  const { coreEventTopics } = await import("./app/coreEvents");
  const { queryClient } = await import("./app/queryClient");
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { unmount } = render(
    <WebSocketProvider>
      <Harness />
    </WebSocketProvider>,
  );
  const socket = sockets.at(-1);
  socket.readyState = 1;
  act(() => socket.onopen());
  act(() =>
    socket.onmessage({
      data: JSON.stringify({
        status: "success",
        message: "Authenticated successfully",
      }),
    }),
  );
  const subscriptions = socket.send.mock.calls
    .map(([raw]) => JSON.parse(raw))
    .filter((frame) => frame.action === "subscribe")
    .map((frame) => frame.topic);
  expect(subscriptions).toEqual(expect.arrayContaining(coreEventTopics));
  expect(invalidate).toHaveBeenCalledWith();
  unmount();
  invalidate.mockRestore();
});
