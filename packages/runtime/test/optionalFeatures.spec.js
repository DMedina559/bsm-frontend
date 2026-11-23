import { expect, it, vi } from "vitest";
import { createFixture } from "./fixture.js";
import { createRuntimeDiagnostics } from "../src/runtimeDiagnostics.js";
it("compacts old terminal payloads without losing replay guards or full HTTP reloads", () => {
  const { runtime } = createFixture();
  const state = runtime.stateReconciler;
  const stale = state.capture();
  for (let i = 0; i < 1200; i++) {
    state.task({
      id: String(i),
      status: "completed",
      epoch: "one",
      revision: i + 1,
      result: { large: "x".repeat(1000) },
      error: null,
      message: "done",
    });
    state.accept(
      ["event", "changed", String(i)],
      { large: "x".repeat(1000) },
      { epoch: "one", revision: i + 1 },
    );
  }
  const stats = state.compact();
  expect(stats.payloads).toBeLessThanOrEqual(100);
  expect(state.read(["task", "0"]).value).toEqual({
    id: "0",
    task_id: undefined,
    status: "completed",
  });
  expect(
    state.task({ id: "0", status: "running", epoch: "one", revision: 1 })
      .accepted,
  ).toBe(false);
  expect(
    state.task(
      { id: "0", status: "running" },
      { source: "http", ticket: stale },
    ).accepted,
  ).toBe(false);
  expect(
    state.task(
      {
        id: "0",
        status: "completed",
        epoch: "one",
        revision: 1,
        result: { restored: true },
        error: null,
        message: "done",
      },
      { source: "http", ticket: state.capture() },
    ).accepted,
  ).toBe(true);
  expect(state.read(["task", "0"]).value.result).toEqual({ restored: true });
  expect(
    state.accept(["event", "changed", "0"], {}, { epoch: "one", revision: 1 })
      .accepted,
  ).toBe(false);
  state.task({ id: "new", status: "running", epoch: "two", revision: 1 });
  expect(
    state.task({ id: "0", status: "running", epoch: "one", revision: 5000 })
      .accepted,
  ).toBe(false);
});
it("keeps diagnostics bounded, opt-in and free of payload values", async () => {
  const { runtime } = createFixture();
  runtime.stateReconciler.task({
    id: "private",
    status: "bad",
    token: "secret",
  });
  expect(runtime.diagnostics.getSnapshot().events).toEqual([]);
  runtime.diagnostics.setEnabled(true);
  for (let i = 0; i < 1500; i++)
    runtime.stateReconciler.task({
      id: "private",
      status: "bad",
      token: "secret",
    });
  await runtime.refreshResources([["servers", "private"]]);
  const snapshot = runtime.diagnostics.getSnapshot();
  expect(snapshot.events).toHaveLength(1000);
  expect(JSON.stringify(snapshot)).not.toMatch(/private|secret|token/);
  expect(snapshot.events.at(-1)).toMatchObject({
    type: "refresh",
    family: "servers",
  });
  runtime.reset();
  expect(runtime.diagnostics.getSnapshot().events).toEqual([]);
});
it("starts and stops task recovery with cross-tab ownership", () => {
  const { runtime, callOperation } = createFixture();
  let ownership;
  const manager = {
    start: vi.fn(() => () => {}),
    subscribeOwnership: (listener) => {
      ownership = listener;
      listener(false);
      return vi.fn();
    },
  };
  const owner = runtime.start({ identity: "account", manager });
  expect(callOperation).not.toHaveBeenCalled();
  ownership(true);
  expect(callOperation).toHaveBeenCalledWith("list_tasks", expect.anything());
  ownership(false);
  owner.stop();
});
it("notifies diagnostic observers and supports unsubscribing", () => {
  const diagnostics = createRuntimeDiagnostics(2);
  const observe = vi.fn();
  const stop = diagnostics.subscribe(observe);
  diagnostics.setEnabled(true);
  diagnostics.subscriptions(3, 5);
  expect(diagnostics.getSnapshot()).toMatchObject({
    subscriptions: 3,
    references: 5,
  });
  stop();
  diagnostics.record("test");
  expect(observe).toHaveBeenCalledTimes(2);
});
it("keeps revisioned field watermarks when a later fleet response omits revisions", () => {
  const { runtime } = createFixture();
  runtime.reconcileServerSnapshot(
    { servers: [{ name: "one", status: "STOPPED" }] },
    runtime.captureStateRequest(),
  );
  runtime.reconcileSocketMessage({
    type: "event",
    topic: "event:after_server_status_change",
    epoch: "epoch",
    revision: 5,
    data: {
      result: { server_name: "one", status: "success", new_status: "RUNNING" },
    },
  });
  const result = runtime.reconcileServerSnapshot(
    { servers: [{ name: "one", status: "STOPPED" }] },
    runtime.captureStateRequest(),
  );
  expect(result.servers[0].status).toBe("RUNNING");
});
it("pauses without erasing evidence and disables recording at the session boundary", () => {
  const { runtime } = createFixture();
  runtime.diagnostics.setEnabled(true);
  runtime.diagnostics.record("rejected", { reason: "invalid-task" });
  runtime.diagnostics.setEnabled(false);
  expect(runtime.diagnostics.getSnapshot().events).toHaveLength(1);
  runtime.reset();
  expect(runtime.diagnostics.getSnapshot()).toMatchObject({
    enabled: false,
    events: [],
    subscriptions: 0,
    references: 0,
  });
});
