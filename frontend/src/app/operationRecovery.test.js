import { queryClient } from "./queryClient";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { operationCoordinator } from "./operationCoordinator";
import { startOperationRecovery } from "./operationRecovery";
import { sessionRuntime } from "./sessionRuntime";
import { get } from "../test/httpFixtures";
vi.mock("../api", async (importOriginal) => {
  const { createHttpTransport, configureHttpFixtures } =
    await import("../test/httpFixtures");
  const fixtures = { get: vi.fn() };
  configureHttpFixtures(fixtures);
  return createHttpTransport(await importOriginal());
});
beforeEach(() => {
  vi.useFakeTimers();
  operationCoordinator.clear();
  queryClient.clear();
  get.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  operationCoordinator.clear();
});
it("recovers task completion independently of pages and drops obsolete responses", async () => {
  let finish;
  get.mockImplementation((url) =>
    url === "/api/tasks/list"
      ? Promise.resolve([])
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const stop = startOperationRecovery();
  operationCoordinator.register({
    id: "task",
    kind: "backup",
    serverName: "alpha",
  });
  await Promise.resolve();
  finish({ status: "completed", progress: 100 });
  await vi.advanceTimersByTimeAsync(1);
  expect(operationCoordinator.get("task").terminal).toBe(true);
  get.mockImplementation((url) =>
    url === "/api/tasks/list"
      ? Promise.resolve([])
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  operationCoordinator.register({ id: "old", kind: "restore" });
  sessionRuntime.reset();
  finish({ status: "completed" });
  await vi.advanceTimersByTimeAsync(1);
  expect(operationCoordinator.get("old").status).toBe("pending");
  stop();
});
it("bounds concurrent task polls and backs off failures", async () => {
  for (let i = 0; i < 10; i++)
    operationCoordinator.register({ id: String(i), kind: "backup" });
  let active = 0;
  let maximum = 0;
  get.mockImplementation(async (url) => {
    if (url === "/api/tasks/list") return [];
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    throw new Error("offline backend");
  });
  const stop = startOperationRecovery();
  await vi.advanceTimersByTimeAsync(50);
  expect(maximum).toBe(4);
  expect(
    get.mock.calls.filter(([url]) => url.includes("/status/")).length,
  ).toBe(10);
  await vi.advanceTimersByTimeAsync(5000);
  expect(
    get.mock.calls.filter(([url]) => url.includes("/status/")).length,
  ).toBe(10);
  stop();
});
it("rediscovers active tasks after a backend epoch change", async () => {
  const { stateReconciler } = await import("./stateReconciler");
  stateReconciler.clear();
  stateReconciler.accept(["monitor"], { epoch: "first", revision: 100 });
  let restarted = false;
  get.mockImplementation(async (url) =>
    url === "/api/tasks/list"
      ? restarted
        ? [
            {
              id: "new-task",
              status: "running",
              message: "Running",
              epoch: "next",
              revision: 2,
            },
          ]
        : []
      : {
          id: "new-task",
          status: "running",
          message: "Running",
          epoch: "next",
          revision: 2,
        },
  );
  const stop = startOperationRecovery();
  await vi.advanceTimersByTimeAsync(1);
  restarted = true;
  stateReconciler.accept(
    ["monitor"],
    { epoch: "next", revision: 1 },
    { ticket: stateReconciler.capture() },
  );
  await vi.advanceTimersByTimeAsync(1);
  expect(operationCoordinator.get("new-task")?.status).toBe("running");
  expect(
    get.mock.calls.filter(([url]) => url === "/api/tasks/list"),
  ).toHaveLength(2);
  stop();
  stateReconciler.clear();
});
it("retries discovery without registered tasks and refreshes on reconnect", async () => {
  let calls = 0;
  get.mockImplementation(async (url) => {
    if (url !== "/api/tasks/list")
      return { id: "recovered", status: "running" };
    calls++;
    if (calls === 1) throw new Error("offline");
    return [];
  });
  const stop = startOperationRecovery();
  await vi.advanceTimersByTimeAsync(2100);
  expect(calls).toBe(2);
  window.dispatchEvent(new Event("bsm:socket-connected"));
  await vi.advanceTimersByTimeAsync(1);
  expect(calls).toBe(3);
  stop();
  window.dispatchEvent(new Event("bsm:socket-connected"));
  await vi.advanceTimersByTimeAsync(60000);
  expect(calls).toBe(3);
});
it("queues one rediscovery when reconnects arrive during discovery", async () => {
  let finish;
  get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  get.mockResolvedValue([]);
  const stop = startOperationRecovery();
  await vi.advanceTimersByTimeAsync(1);
  window.dispatchEvent(new Event("bsm:socket-connected"));
  window.dispatchEvent(new Event("bsm:socket-connected"));
  finish([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(
    get.mock.calls.filter(([url]) => url === "/api/tasks/list"),
  ).toHaveLength(2);
  stop();
});
