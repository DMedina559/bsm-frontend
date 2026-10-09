import { queryClient } from "./queryClient";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { operationCoordinator } from "./operationCoordinator";
import { startOperationRecovery } from "./operationRecovery";
import { sessionRuntime } from "./sessionRuntime";
import { get } from "../api";
vi.mock("../api", () => ({ get: vi.fn() }));
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
