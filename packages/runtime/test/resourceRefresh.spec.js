import { it, expect, vi } from "vitest";
import { createFixture } from "./fixture.js";

it("coalesces a burst by resource and keeps unrelated caches out of recovery", async () => {
  const { runtime, queryClient } = createFixture();
  const before = vi.fn();
  await Promise.all([
    runtime.refreshResources([["servers"]], before),
    runtime.refreshResources([["servers"], ["monitor", "alpha"]]),
    runtime.refreshResources([["servers"]]),
  ]);
  expect(before).toHaveBeenCalledOnce();
  expect(queryClient.cancelQueries).toHaveBeenCalledTimes(2);
  expect(
    queryClient.invalidateQueries.mock.calls.map(([filter]) => filter.queryKey),
  ).toEqual([["servers"], ["monitor", "alpha"]]);
});

it("drops queued refreshes and callbacks from a retired session", async () => {
  const { runtime, queryClient } = createFixture();
  const before = vi.fn();
  const previous = runtime.refreshResources([["settings"]], before);
  runtime.reset();
  await previous;
  expect(queryClient.cancelQueries).not.toHaveBeenCalled();
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(before).not.toHaveBeenCalled();
});

it("rejects stale continuations after cancellation yields to a new backend", async () => {
  const { runtime, queryClient, setBackend } = createFixture();
  let finish;
  queryClient.cancelQueries.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = runtime.refreshResources([["settings"]]);
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  setBackend("https://other.example/prefix");
  finish();
  await pending;
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
});

it("claims terminal UI effects only once without consuming unavailable progress", () => {
  const { runtime } = createFixture();
  const coordinator = runtime.operationCoordinator;
  coordinator.register({ id: "task", kind: "backup" });
  coordinator.markUnavailable("task", { message: "Unavailable" });
  expect(coordinator.get("task").terminal).toBe(false);
  runtime.reconcileTaskResponse(
    { id: "task", status: "completed" },
    runtime.captureStateRequest(),
  );
  expect(coordinator.acknowledge("task")).toBe(true);
  expect(coordinator.acknowledge("task")).toBe(false);
});

it("recovers the affected family for an incomplete event without accepting its metadata", async () => {
  const { runtime, queryClient } = createFixture();
  runtime.reconcileSocketMessage({
    type: "event",
    topic: "event:after_backup",
    data: {},
  });
  await vi.waitFor(() =>
    expect(queryClient.invalidateQueries).toHaveBeenCalledOnce(),
  );
  const [filter] = queryClient.invalidateQueries.mock.calls[0];
  expect(filter.predicate({ queryKey: ["servers", "alpha", "backups"] })).toBe(
    true,
  );
  expect(filter.predicate({ queryKey: ["servers", "alpha", "settings"] })).toBe(
    false,
  );
  expect(runtime.stateReconciler.entries("event")).toHaveLength(0);
});

it("validates task lists before their epoch or query snapshot can change accepted state", () => {
  const { runtime } = createFixture();
  runtime.stateReconciler.accept(["monitor"], {
    epoch: "current",
    revision: 2,
  });
  const ticket = runtime.captureStateRequest();
  expect(() =>
    runtime.reconcileResourceSnapshot(
      "tasks",
      null,
      ["tasks"],
      [{ id: "bad", status: "running", epoch: "unexpected", revision: -1 }],
      ticket,
    ),
  ).toThrow("Invalid task list");
  expect(runtime.stateReconciler.entries("query")).toHaveLength(0);
  expect(runtime.stateReconciler.read(["monitor"]).epoch).toBe("current");
});

it("keeps null plugin-page selection as a literal query key", async () => {
  const { runtime, queryClient } = createFixture();
  const key = [
    "plugin-page",
    "/api/plugin/page",
    null,
    { identity: "admin", generation: 0 },
  ];
  await runtime.refreshResources([key]);
  const [filter] = queryClient.invalidateQueries.mock.calls[0];
  expect(filter.queryKey).toEqual(key);
  expect(filter.predicate).toBeUndefined();
});
