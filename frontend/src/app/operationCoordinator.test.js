import { queryClient } from "./queryClient";
import { describe, expect, it, vi } from "vitest";
import { createOperationCoordinator } from "./operationCoordinator";

describe("operation coordinator", () => {
  it("reconciles registered task updates and terminal states", () => {
    const coordinator = createOperationCoordinator();
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(listener);
    coordinator.register({
      id: "task-1",
      kind: "install",
      serverName: "alpha",
    });
    expect(
      coordinator.reconcileTask({
        type: "task_update",
        data: { id: "task-1", status: "completed", progress: 100 },
      }),
    ).toBe(true);
    expect(coordinator.get("task-1").terminal).toBe(true);
    expect(coordinator.get("task-1").task.progress).toBe(100);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("ignores unrelated or unknown task updates", () => {
    const coordinator = createOperationCoordinator();
    expect(
      coordinator.reconcileTask({ type: "event", data: { id: "x" } }),
    ).toBe(false);
    expect(
      coordinator.reconcileTask({ type: "task_update", data: { id: "x" } }),
    ).toBe(false);
  });

  it("marks terminal tasks immediately and keeps nonterminal tasks active", () => {
    const coordinator = createOperationCoordinator();
    coordinator.register({ id: "done", kind: "backup", status: "completed" });
    coordinator.register({ id: "running", kind: "install", status: "running" });
    expect(coordinator.get("done").terminal).toBe(true);
    expect(coordinator.get("running").terminal).toBe(false);
  });

  it("accepts task_id snapshots from the backend", () => {
    const coordinator = createOperationCoordinator();
    coordinator.register({ id: "task-42", kind: "restore" });
    expect(
      coordinator.reconcileTask({
        type: "task_update",
        data: { task_id: "task-42", status: "failed", error: "Restore failed" },
      }),
    ).toBe(true);
    expect(coordinator.get("task-42").terminal).toBe(true);
    expect(coordinator.get("task-42").task.error).toBe("Restore failed");
  });

  it("clears session operations", () => {
    const coordinator = createOperationCoordinator();
    coordinator.register({ id: "one", kind: "start" });
    coordinator.clear();
    expect(coordinator.list()).toEqual([]);
  });
});

it("preserves completed snapshots when adding operation metadata", () => {
  const coordinator = createOperationCoordinator();
  coordinator.register({ id: "fast-task", kind: "background" });
  coordinator.reconcileTask({
    type: "task_update",
    data: { id: "fast-task", status: "completed" },
  });
  coordinator.register({
    id: "fast-task",
    kind: "install",
    serverName: "alpha",
  });
  expect(coordinator.get("fast-task").terminal).toBe(true);
  expect(coordinator.get("fast-task").serverName).toBe("alpha");
});
it("notifies other subscribers when a listener throws", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const coordinator = createOperationCoordinator();
  coordinator.subscribe(() => {
    throw new Error("broken listener");
  });
  const listener = vi.fn();
  coordinator.subscribe(listener);
  coordinator.register({ id: "one", kind: "backup" });
  expect(listener).toHaveBeenCalledTimes(2);
  log.mockRestore();
});

it("backup completion only invalidates task and backup resources", () => {
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();
  const coordinator = createOperationCoordinator();
  coordinator.register({
    id: "backup",
    kind: "backup:create",
    serverName: "alpha",
  });
  coordinator.reconcileTask({
    type: "task_update",
    data: { id: "backup", status: "completed" },
  });
  expect(invalidate.mock.calls.map(([options]) => options.queryKey)).toEqual([
    ["tasks"],
    ["servers", "alpha", "backups"],
  ]);
  invalidate.mockRestore();
});

it("refreshes installed addons after background addon completion", () => {
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();
  const coordinator = createOperationCoordinator();
  coordinator.register({
    id: "addon",
    kind: "addon:install",
    serverName: "alpha",
  });
  coordinator.reconcileTask({
    type: "task_update",
    data: { id: "addon", status: "completed" },
  });
  expect(
    invalidate.mock.calls.map(([options]) => options.queryKey),
  ).toContainEqual(["servers", "alpha", "addons"]);
  invalidate.mockRestore();
});
