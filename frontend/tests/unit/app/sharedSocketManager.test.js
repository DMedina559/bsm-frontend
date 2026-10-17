import { expect, it, vi } from "vitest";
import { createApplicationRuntime } from "@bedrock-server-manager/runtime";
import { createSharedSocketManager } from "../../../src/app/sharedSocketManager";
function cluster() {
  const channels = new Set();
  const frames = [];
  class Channel {
    constructor(name) {
      this.name = name;
      channels.add(this);
    }
    postMessage(data) {
      frames.push(data);
      for (const channel of channels)
        if (channel !== this && channel.name === this.name)
          queueMicrotask(() => {
            if (channels.has(channel))
              channel.onmessage?.({ data: structuredClone(data) });
          });
    }
    close() {
      channels.delete(this);
    }
  }
  const queues = new Map();
  const locks = {
    request(name, { signal }, callback) {
      return new Promise((resolve, reject) => {
        const jobs = queues.get(name) ?? [];
        queues.set(name, jobs);
        const run = () => {
          if (jobs[0]?.running) return;
          const job = jobs[0];
          if (!job) return;
          job.running = true;
          signal.removeEventListener("abort", abort);
          Promise.resolve()
            .then(job.callback)
            .then(job.resolve, job.reject)
            .finally(() => {
              jobs.shift();
              run();
            });
        };
        const job = { callback, resolve, reject, running: false };
        const abort = () => {
          if (job.running) return;
          const index = jobs.indexOf(job);
          if (index >= 0) jobs.splice(index, 1);
          reject(new DOMException("Aborted", "AbortError"));
          run();
        };
        signal.addEventListener("abort", abort, { once: true });
        jobs.push(job);
        run();
      });
    },
  };
  let clock = 0;
  const tabs = [];
  const tab = (id) => {
    const queryClient = {
      clear: vi.fn(),
      cancelQueries: vi.fn(async () => {}),
      invalidateQueries: vi.fn(async () => {}),
      setQueriesData: vi.fn(),
      resetQueries: vi.fn(async () => {}),
      removeQueries: vi.fn(),
      fetchQuery: vi.fn(async () => []),
    };
    const runtime = createApplicationRuntime({
      queryClient,
      getBackendIdentity: () => "backend",
      callOperation: vi.fn(async () => []),
      resolveWebSocketUrl: () => "ws://bsm",
      platform: { isOnline: () => false },
    });
    const callbacks = {};
    const state = vi.fn();
    const incoming = vi.fn((frame, ticket) =>
      runtime.reconcileSocketMessage(frame, ticket),
    );
    const socket = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      reconnect: vi.fn(),
      sendMessage: vi.fn(),
      start: vi.fn(() => {
        callbacks.onState({
          isConnected: true,
          isFallback: false,
          connectionState: "connected",
        });
        return vi.fn();
      }),
    };
    let heartbeat;
    const events = new EventTarget();
    const visibility = new EventTarget();
    visibility.visibilityState = "visible";
    const manager = createSharedSocketManager({
      id,
      runtime,
      locks,
      Channel,
      events,
      visibility,
      now: () => clock,
      setInterval: (callback) => {
        heartbeat = callback;
      },
      clearInterval: vi.fn(),
      createManager: (handlers) => {
        Object.assign(callbacks, handlers);
        return socket;
      },
      onMessage: incoming,
      onState: state,
    });
    const result = {
      manager,
      runtime,
      socket,
      incoming,
      callbacks,
      events,
      visibility,
      tick: () => heartbeat?.(),
    };
    tabs.push(result);
    return result;
  };
  return {
    tab,
    frames,
    elapse: (ms) => {
      clock += ms;
    },
    advance: (ms) => {
      clock += ms;
      tabs.forEach((tab) => tab.tick());
    },
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
it("shares one socket, retains union subscriptions, and transfers ownership on close", async () => {
  const { tab } = cluster();
  const first = tab("one"),
    second = tab("two");
  first.manager.subscribe("shared");
  second.manager.subscribe("shared");
  second.manager.subscribe("second-only");
  const stopFirst = first.manager.start("backend/account");
  await settle();
  const stopSecond = second.manager.start("backend/account");
  await settle();
  expect(first.socket.start).toHaveBeenCalledOnce();
  expect(second.socket.start).not.toHaveBeenCalled();
  expect(first.socket.subscribe.mock.calls.flat()).toEqual(
    expect.arrayContaining(["shared", "second-only"]),
  );
  first.manager.unsubscribe("shared");
  expect(first.socket.unsubscribe).not.toHaveBeenCalledWith("shared");
  stopFirst();
  await settle();
  expect(second.socket.start).toHaveBeenCalledOnce();
  expect(second.socket.subscribe).toHaveBeenCalledWith("shared");
  stopSecond();
});
it("shares pending task discovery and accepted HTTP results without credentials or writes", async () => {
  const { tab, frames } = cluster();
  const first = tab("one"),
    second = tab("two");
  const stopFirst = first.manager.start("account");
  await settle();
  const stopSecond = second.manager.start("account");
  await settle();
  second.runtime.operationCoordinator.register({
    id: "task",
    kind: "install",
    serverName: "new",
    secret: "not-shared",
  });
  await settle();
  expect(first.runtime.operationCoordinator.get("task").serverName).toBe("new");
  first.runtime.reconcileTaskResponse(
    {
      id: "task",
      status: "completed",
      epoch: "epoch",
      revision: 2,
      result: { success: true },
    },
    first.runtime.captureStateRequest(),
  );
  await settle();
  expect(second.runtime.operationCoordinator.get("task").terminal).toBe(true);
  expect(JSON.stringify(frames)).not.toMatch(/not-shared|authenticate|token/);
  second.manager.sendMessage({ action: "authenticate", token: "not-shared" });
  expect(first.socket.sendMessage).not.toHaveBeenCalled();
  stopFirst();
  stopSecond();
});
it("isolates accounts and ignores retired callbacks after switching identity", async () => {
  const { tab } = cluster();
  const first = tab("one"),
    second = tab("two");
  const stopFirst = first.manager.start("account-one");
  const stopSecond = second.manager.start("account-two");
  await settle();
  expect(first.socket.start).toHaveBeenCalledOnce();
  expect(second.socket.start).toHaveBeenCalledOnce();
  first.callbacks.onMessage(
    { type: "log", data: "private" },
    first.runtime.stateReconciler.capture(),
  );
  await settle();
  expect(second.incoming).not.toHaveBeenCalled();
  stopFirst();
  stopSecond();
  const stopNext = first.manager.start("new-account");
  await settle();
  stopFirst();
  expect(first.socket.start).toHaveBeenCalledTimes(2);
  stopNext();
});
it("aborts a queued owner before it can take over", async () => {
  const { tab } = cluster();
  const first = tab("one"),
    second = tab("two");
  const stopFirst = first.manager.start("account");
  await settle();
  const stopSecond = second.manager.start("account");
  stopSecond();
  stopFirst();
  await settle();
  expect(second.socket.start).not.toHaveBeenCalled();
});
it("uses the independent manager when browser coordination is unavailable", () => {
  const manager = {};
  expect(
    createSharedSocketManager({
      createManager: () => manager,
      locks: null,
      Channel: null,
    }),
  ).toBe(manager);
});

it.each([
  { locks: null, Channel: null },
  { locks: { request: vi.fn() }, Channel: vi.fn() },
])(
  "uses an independent manager without secure-context crypto APIs: %j",
  (capabilities) => {
    const manager = {};
    const onMessage = vi.fn();
    const onState = vi.fn();
    const createManager = vi.fn(() => manager);
    vi.stubGlobal("crypto", {});
    try {
      expect(
        createSharedSocketManager({
          createManager,
          onMessage,
          onState,
          ...capabilities,
        }),
      ).toBe(manager);
      expect(createManager).toHaveBeenCalledWith({ onMessage, onState });
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it("rejoins expired subscriptions immediately when a suspended peer becomes visible", async () => {
  const { tab, elapse } = cluster();
  const first = tab("owner"),
    second = tab("peer");
  second.manager.subscribe("peer-only");
  const stopFirst = first.manager.start("account");
  await settle();
  const stopSecond = second.manager.start("account");
  await settle();
  expect(first.socket.subscribe).toHaveBeenCalledWith("peer-only");
  elapse(13_000);
  first.tick();
  await settle();
  expect(first.socket.unsubscribe).toHaveBeenCalledWith("peer-only");
  second.visibility.dispatchEvent(new Event("visibilitychange"));
  await settle();
  expect(
    first.socket.subscribe.mock.calls.filter(
      ([topic]) => topic === "peer-only",
    ),
  ).toHaveLength(2);
  stopFirst();
  stopSecond();
});
it.each(["pagehide", "freeze"])(
  "releases ownership on %s and rejoins without a second socket",
  async (event) => {
    const { tab } = cluster();
    const first = tab("one"),
      second = tab("two");
    const stopFirst = first.manager.start("account");
    await settle();
    const stopSecond = second.manager.start("account");
    await settle();
    const target = event === "freeze" ? first.visibility : first.events;
    target.dispatchEvent(new Event(event));
    await settle();
    expect(second.socket.start).toHaveBeenCalledOnce();
    target.dispatchEvent(new Event(event === "freeze" ? "resume" : "pageshow"));
    await settle();
    expect(first.socket.start).toHaveBeenCalledOnce();
    stopSecond();
    await settle();
    expect(first.socket.start).toHaveBeenCalledTimes(2);
    stopFirst();
  },
);
