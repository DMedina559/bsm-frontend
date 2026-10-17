import test from "node:test";
import assert from "node:assert/strict";
import { createHost, flush } from "./platform.js";

// Fail on access, including globalThis.window, during import and execution.
for (const name of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "WebSocket",
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      throw new Error(`Browser global accessed: ${name}`);
    },
  });
}
const { createApplicationRuntime } =
  await import("@bedrock-server-manager/runtime");

function create(host, callOperation = async () => []) {
  const data = new Map();
  const invalidations = [];
  const cache = {
    clear() {
      data.clear();
    },
    async cancelQueries() {},
    async resetQueries() {
      data.clear();
    },
    async invalidateQueries(filter) {
      invalidations.push(filter.queryKey);
    },
    removeQueries({ queryKey }) {
      data.delete(JSON.stringify(queryKey));
    },
    setQueriesData({ queryKey }, update) {
      const key = JSON.stringify(queryKey);
      data.set(
        key,
        typeof update === "function" ? update(data.get(key)) : update,
      );
    },
    fetchQuery: ({ queryFn }) =>
      queryFn({ signal: new AbortController().signal }),
  };
  return {
    runtime: createApplicationRuntime({
      queryClient: cache,
      getBackendIdentity: () => "https://bsm.example/prefix",
      callOperation,
      resolveWebSocketUrl: () => "wss://bsm.example/prefix/ws",
      platform: host.platform,
      scheduler: host.scheduler,
    }),
    data,
    invalidations,
  };
}
const authenticate = (socket) => {
  socket.onopen();
  socket.onmessage({
    data: JSON.stringify({
      status: "success",
      message: "Authenticated successfully",
    }),
  });
};

test("injected sockets authenticate, reconcile state, retry, and fully release a reset session", async () => {
  const host = createHost();
  const { runtime, data } = create(host);
  const states = [];
  const manager = runtime.createWebSocketManager({
    onMessage: (message, ticket) =>
      runtime.reconcileSocketMessage(message, ticket),
    onState: (state) => states.push(state),
  });
  manager.subscribe("server:test");
  manager.subscribe("server:test");
  const stop = manager.start("account");
  const first = host.sockets[0];
  const staleMessage = first.onmessage;
  authenticate(first);
  assert.deepEqual(first.sent, [
    { action: "authenticate", token: "secret" },
    { action: "subscribe", topic: "server:test" },
  ]);
  runtime.operationCoordinator.register({
    id: "job",
    kind: "start",
    serverName: "test",
  });
  data.set(JSON.stringify(runtime.queryKeys.tasks()), []);
  first.onmessage({
    data: JSON.stringify({
      type: "task_update",
      data: {
        id: "job",
        status: "completed",
        epoch: "instance",
        revision: 2,
      },
    }),
  });
  assert.equal(runtime.operationCoordinator.get("job").terminal, true);
  assert.equal(
    data.get(JSON.stringify(runtime.queryKeys.tasks()))[0].status,
    "completed",
  );
  first.onclose();
  assert.equal(host.sockets.length, 1);
  await host.advance(999);
  assert.equal(host.sockets.length, 1);
  await host.advance(1);
  assert.equal(host.sockets.length, 2);
  const second = host.sockets[1];
  authenticate(second);
  manager.unsubscribe("server:test");
  assert.equal(second.sent.length, 2);
  manager.unsubscribe("server:test");
  assert.deepEqual(second.sent.at(-1), {
    action: "unsubscribe",
    topic: "server:test",
  });
  runtime.sessionRuntime.reset();
  assert.equal(second.closed, true);
  assert.equal(second.onmessage, null);
  assert.equal(host.listenerCount(), 0);
  assert.equal(host.timers.size, 0);
  const stateCount = states.length;
  staleMessage({
    data: JSON.stringify({
      type: "task_update",
      data: { id: "job", status: "failed" },
    }),
  });
  host.emit("online");
  host.emit("visibilitychange");
  await host.advance(60000);
  assert.equal(host.sockets.length, 2);
  assert.equal(states.length, stateCount);
  stop();
  stop();
});

test("starting a manager again replaces its owner and old cleanup cannot stop the new connection", () => {
  const host = createHost();
  const { runtime } = create(host);
  const manager = runtime.createWebSocketManager({
    onMessage() {},
    onState() {},
  });
  const stopFirst = manager.start("one");
  const stopSecond = manager.start("two");
  assert.equal(host.sockets[0].closed, true);
  assert.equal(host.listenerCount(), 3);
  stopFirst();
  assert.equal(host.sockets[1].closed, false);
  runtime.sessionRuntime.reset();
  assert.equal(host.sockets[1].closed, true);
  assert.equal(host.listenerCount(), 0);
  stopSecond();
});

test("offline and authentication timeout behavior uses only host lifecycle and timers", async () => {
  const host = createHost();
  const { runtime } = create(host);
  const manager = runtime.createWebSocketManager({
    onMessage() {},
    onState() {},
  });
  host.setOnline(false);
  const stop = manager.start("account");
  assert.equal(host.sockets.length, 0);
  host.setOnline(true);
  const socket = host.sockets[0];
  socket.onopen();
  await host.advance(10000);
  assert.equal(socket.closed, true);
  host.setOnline(false);
  assert.equal(host.timers.size, 0);
  stop();
  assert.equal(host.listenerCount(), 0);
});

test("recovery discovers and polls tasks, backs off failures, and reconciles completion", async () => {
  const host = createHost();
  const calls = [];
  let attempts = 0;
  const { runtime, invalidations } = create(
    host,
    async (operation, options) => {
      calls.push({ operation, options });
      if (operation === "list_tasks") return [{ id: "job", status: "running" }];
      attempts += 1;
      if (attempts === 1) throw new Error("temporarily unavailable");
      return { id: "job", status: "completed", epoch: "instance", revision: 3 };
    },
  );
  const stop = runtime.startOperationRecovery("account");
  await flush();
  assert.equal(runtime.operationCoordinator.get("job").status, "running");
  assert.equal(attempts, 1);
  await host.advance(5000);
  assert.equal(attempts, 1);
  await host.advance(5000);
  assert.equal(attempts, 2);
  assert.equal(runtime.operationCoordinator.get("job").terminal, true);
  assert.ok(invalidations.some((key) => key[0] === "servers"));
  stop();
  assert.ok(calls.every(({ options }) => options.signal.aborted));
  assert.equal(host.listenerCount(), 0);
  assert.equal(host.timers.size, 0);
  await host.advance(60000);
  assert.equal(attempts, 2);
});

test("session reset aborts in-flight discovery and rejects late responses from the previous account", async () => {
  const host = createHost();
  let complete;
  let signal;
  const { runtime } = create(host, (_operation, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  const ticket = runtime.captureStateRequest();
  const stop = runtime.startOperationRecovery("old-account");
  runtime.sessionRuntime.reset();
  assert.equal(signal.aborted, true);
  assert.equal(runtime.stateReconciler.current(ticket), false);
  complete([{ id: "old-job", status: "running" }]);
  await flush();
  assert.equal(runtime.operationCoordinator.get("old-job"), null);
  assert.equal(host.listenerCount(), 0);
  assert.equal(host.timers.size, 0);
  stop();
});

test("discovery retries are removed on reset and another runtime remains active", async () => {
  const host = createHost();
  const otherHost = createHost();
  let calls = 0;
  const { runtime } = create(host, async () => {
    calls++;
    throw new Error("offline");
  });
  const { runtime: other } = create(otherHost);
  const stop = runtime.startOperationRecovery("one");
  const stopOther = other.startOperationRecovery("two");
  await flush();
  assert.equal(host.timers.size, 2);
  await host.advance(2000);
  assert.equal(calls, 2);
  runtime.sessionRuntime.reset();
  assert.equal(host.timers.size, 0);
  assert.equal(host.listenerCount(), 0);
  assert.equal(otherHost.timers.size, 1);
  assert.equal(otherHost.listenerCount(), 2);
  stop();
  stopOther();
});

test("HTTP snapshots cannot overwrite newer events or outlive cancellation and backend restarts", async () => {
  const host = createHost();
  const { runtime, data } = create(host);
  const key = runtime.queryKeys.servers();
  const fleet = {
    epoch: "first",
    revision: 1,
    servers: [{ name: "test", status: "STOPPED" }],
  };
  runtime.reconcileServerSnapshot(fleet, runtime.captureStateRequest());
  data.set(JSON.stringify(key), fleet);
  const slow = runtime.captureStateRequest();
  assert.equal(
    runtime.reconcileSocketMessage(
      {
        type: "event",
        topic: "event:after_server_status_change",
        epoch: "first",
        revision: 3,
        data: { server_name: "test", status: "success", new_status: "RUNNING" },
      },
      runtime.captureStateRequest(),
    ),
    true,
  );
  const selected = runtime.reconcileServerSnapshot(
    { ...fleet, revision: 2 },
    slow,
  );
  assert.equal(selected.servers[0].status, "RUNNING");
  const controller = new AbortController();
  const cancelled = runtime.captureStateRequest(controller.signal);
  controller.abort();
  assert.throws(
    () =>
      runtime.reconcileResourceSnapshot(
        "settings",
        null,
        ["settings"],
        {},
        cancelled,
      ),
    { name: "AbortError" },
  );
  const previous = runtime.captureStateRequest();
  runtime.reconcileTaskResponse(
    { id: "new-task", status: "running", epoch: "second", revision: 1 },
    runtime.captureStateRequest(),
  );
  assert.equal(runtime.stateReconciler.current(previous), false);
  assert.throws(() => runtime.reconcileServerSnapshot(fleet, previous), {
    name: "AbortError",
  });
  await flush();
  assert.equal(data.get(JSON.stringify(key)), undefined);
});

test("missing revisioned tasks become unavailable without rewriting backend history", async () => {
  const host = createHost();
  let polls = 0;
  const { runtime } = create(host, async (id) => {
    if (id === "list_tasks") return [];
    polls++;
    throw Object.assign(Error("expired"), { status: 404 });
  });
  runtime.operationCoordinator.register({ id: "expired", kind: "backup" });
  runtime.reconcileTaskResponse(
    { id: "expired", status: "running", epoch: "instance", revision: 3 },
    runtime.captureStateRequest(),
  );
  const stop = runtime.startOperationRecovery("account");
  await flush();
  await host.advance(15000);
  assert.equal(runtime.operationCoordinator.get("expired").status, "unknown");
  assert.equal(
    runtime.stateReconciler.read(["task", "expired"]).value.status,
    "running",
  );
  assert.equal(polls, 1);
  stop();
});

test("application reset and disposal release the active owner, drafts, operations and cache", async () => {
  const host = createHost();
  const { runtime, data } = create(host);
  const owner = runtime.start({
    identity: "account",
    onMessage() {},
    onState() {},
  });
  runtime.draftRegistry.register();
  runtime.operationCoordinator.register({ id: "job" });
  data.set("cached", "old account");
  runtime.reset();
  owner.stop();
  runtime.dispose();
  await flush();
  assert.equal(host.listenerCount(), 0);
  assert.equal(host.timers.size, 0);
  assert.equal(runtime.draftRegistry.dirty(), false);
  assert.equal(runtime.operationCoordinator.list().length, 0);
  assert.equal(data.size, 0);
});
