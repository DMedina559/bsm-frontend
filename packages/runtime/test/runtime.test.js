import test from "node:test";
import assert from "node:assert/strict";
import { createApplicationRuntime } from "../src/index.js";

const create = () =>
  createApplicationRuntime({
    queryClient: { resetQueries() {} },
    getBackendIdentity: () => "https://bsm.example/prefix",
    callOperation: async () => [],
    resolveWebSocketUrl: () => "wss://bsm.example/prefix/ws",
    platform: {},
  });

test("runtime instances isolate sessions, state and dirty drafts without browser globals", () => {
  const one = create(),
    two = create();
  const first = one.sessionRuntime.capture(),
    second = two.sessionRuntime.capture();
  const ticket = one.captureStateRequest();
  const clean = one.draftRegistry.register();
  assert.equal(one.draftRegistry.dirty(), true);
  assert.equal(two.draftRegistry.dirty(), false);
  one.sessionRuntime.reset();
  assert.equal(one.sessionRuntime.isCurrent(first), false);
  assert.equal(first.signal.aborted, true);
  assert.equal(one.stateReconciler.current(ticket), false);
  assert.equal(two.sessionRuntime.isCurrent(second), true);
  assert.equal(second.signal.aborted, false);
  clean();
});

test("WebSocket authentication, subscriptions and session cleanup use the injected platform", () => {
  const events = new EventTarget();
  const sent = [];
  let socket;
  let closed = false;
  const runtime = createApplicationRuntime({
    queryClient: { resetQueries() {} },
    getBackendIdentity: () => "https://bsm.example",
    callOperation: async () => [],
    resolveWebSocketUrl: () => "wss://bsm.example/ws",
    platform: {
      isOnline: () => true,
      isVisible: () => true,
      getToken: () => "secret",
      createWebSocket: () =>
        (socket = {
          readyState: 1,
          send: (value) => sent.push(JSON.parse(value)),
          close: () => {
            closed = true;
          },
        }),
      connected: () => events.dispatchEvent(new Event("bsm:socket-connected")),
      addEventListener: (type, listener) =>
        events.addEventListener(type, listener),
      removeEventListener: (type, listener) =>
        events.removeEventListener(type, listener),
    },
  });
  const messages = [];
  const manager = runtime.createWebSocketManager({
    onMessage: (message) => messages.push(message),
    onState() {},
  });
  manager.subscribe("server:test");
  const stop = manager.start("account");
  try {
    socket.onopen();
    assert.deepEqual(sent[0], { action: "authenticate", token: "secret" });
    socket.onmessage({
      data: JSON.stringify({
        status: "success",
        message: "Authenticated successfully",
      }),
    });
    assert.deepEqual(sent[1], { action: "subscribe", topic: "server:test" });
    socket.onmessage({ data: JSON.stringify({ type: "test", data: {} }) });
    assert.equal(messages.length, 1);
    runtime.sessionRuntime.reset();
    assert.equal(closed, true);
    assert.equal(socket.onmessage, null);
  } finally {
    stop();
  }
});
