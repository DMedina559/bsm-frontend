import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createWebSocketManager } from "./webSocketManager";
import { sessionRuntime } from "./sessionRuntime";
vi.mock("../api", () => ({ getApiBaseUrl: () => "" }));
let sockets;
class Socket {
  static OPEN = 1;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    sockets.push(this);
  }
}
beforeEach(() => {
  sockets = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("authenticated websocket runtime", () => {
  it("restores reference-counted subscriptions after auth, reconnects and releases resources", () => {
    const message = vi.fn();
    const manager = createWebSocketManager({
      onMessage: message,
      onState: vi.fn(),
    });
    manager.subscribe("players");
    manager.subscribe("players");
    const stop = manager.start("account");
    const first = sockets[0];
    first.onopen();
    first.onmessage({
      data: JSON.stringify({ type: "event", topic: "players" }),
    });
    expect(message).not.toHaveBeenCalled();
    first.onmessage({
      data: JSON.stringify({
        status: "success",
        message: "Authenticated successfully",
      }),
    });
    expect(first.send).toHaveBeenCalledWith(
      JSON.stringify({ action: "subscribe", topic: "players" }),
    );
    manager.unsubscribe("players");
    expect(first.send).not.toHaveBeenCalledWith(
      JSON.stringify({ action: "unsubscribe", topic: "players" }),
    );
    const staleMessage = first.onmessage;
    first.onclose();
    vi.advanceTimersByTime(1500);
    expect(sockets).toHaveLength(2);
    staleMessage({ data: JSON.stringify({ type: "event", topic: "players" }) });
    expect(message).not.toHaveBeenCalled();
    stop();
    vi.advanceTimersByTime(60000);
    expect(sockets).toHaveLength(2);
    expect(sockets[1].close).toHaveBeenCalledOnce();
  });
  it("closes immediately at the session boundary", () => {
    const manager = createWebSocketManager({
      onMessage: vi.fn(),
      onState: vi.fn(),
    });
    const stop = manager.start("account");
    sessionRuntime.reset();
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expect(sockets[0].onmessage).toBeNull();
    stop();
  });
});
it("reconnects and rejects the old socket when HTTP discovers a backend restart", async () => {
  const { stateReconciler } = await import("./stateReconciler");
  stateReconciler.clear();
  stateReconciler.accept(["monitor"], { epoch: "first", revision: 100 });
  const message = vi.fn();
  const manager = createWebSocketManager({
    onMessage: message,
    onState: vi.fn(),
  });
  manager.subscribe("resource-monitor:alpha");
  const stop = manager.start("account");
  const old = sockets[0];
  const stale = old.onmessage;
  stateReconciler.accept(
    ["monitor"],
    { epoch: "next", revision: 1 },
    { source: "http", ticket: stateReconciler.capture() },
  );
  expect(old.close).toHaveBeenCalledOnce();
  expect(sockets).toHaveLength(2);
  stale({
    data: JSON.stringify({
      type: "resource_update",
      data: { epoch: "first", revision: 101 },
    }),
  });
  expect(message).not.toHaveBeenCalled();
  sockets[1].onopen();
  sockets[1].onmessage({
    data: JSON.stringify({
      status: "success",
      message: "Authenticated successfully",
    }),
  });
  expect(sockets[1].send).toHaveBeenCalledWith(
    JSON.stringify({ action: "subscribe", topic: "resource-monitor:alpha" }),
  );
  stop();
  stateReconciler.clear();
});
