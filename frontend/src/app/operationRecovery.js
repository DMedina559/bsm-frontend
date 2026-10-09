import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import { get } from "../api";
import { operationCoordinator } from "./operationCoordinator";
import { sessionRuntime } from "./sessionRuntime";
/** Polling is owned by the session, so navigation cannot abandon a task. */
export function startOperationRecovery(identity = null, generation = 0) {
  const session = sessionRuntime.capture();
  const controller = new AbortController();
  let stopped = false;
  let polling = false;
  const poll = async () => {
    if (stopped || polling || navigator.onLine === false) return;
    if (
      !operationCoordinator
        .list()
        .some(
          (operation) => !operation.terminal && operation.status !== "unknown",
        )
    )
      return;
    polling = true;
    try {
      await Promise.allSettled(
        operationCoordinator
          .list()
          .filter(
            (operation) =>
              !operation.terminal && operation.status !== "unknown",
          )
          .map(async (operation) => {
            try {
              const data = await get(
                `/api/tasks/status/${encodeURIComponent(operation.id)}`,
                { signal: controller.signal },
              );
              if (!stopped && sessionRuntime.isCurrent(session))
                operationCoordinator.reconcileTask({
                  type: "task_update",
                  data: { ...data, task_id: operation.id },
                });
            } catch (error) {
              if (
                !stopped &&
                sessionRuntime.isCurrent(session) &&
                error.status === 404
              )
                operationCoordinator.reconcileTask({
                  type: "task_update",
                  data: {
                    task_id: operation.id,
                    status: "unknown",
                    error: "Task snapshot is unavailable",
                  },
                });
            }
          }),
      );
    } finally {
      polling = false;
    }
  };
  // Task lists are account-filtered by the backend. Snapshots lack operation
  // metadata, so unknown tasks are restored as generic background operations.
  void queryClient
    .fetchQuery({
      queryKey: [...queryKeys.tasks(), { identity, generation }],
      queryFn: ({ signal }) =>
        get("/api/tasks/list", {
          signal: AbortSignal.any([signal, controller.signal]),
        }),
    })
    .then((tasks) => {
      if (
        stopped ||
        !sessionRuntime.isCurrent(session) ||
        !Array.isArray(tasks)
      )
        return;
      tasks.forEach((task) => {
        if (
          !task ||
          typeof task.id !== "string" ||
          !["queued", "running", "cancelling"].includes(task.status)
        )
          return;
        if (!operationCoordinator.get(task.id))
          operationCoordinator.register({
            id: task.id,
            kind: "background",
            status: task.status,
          });
        operationCoordinator.reconcileTask({ type: "task_update", data: task });
      });
    })
    .catch(() => {
      /* Poll registered operations even if listing is unavailable. */
    });
  const timer = setInterval(poll, 5000);
  const unsubscribe = operationCoordinator.subscribe(poll);
  window.addEventListener("online", poll);
  const stop = () => {
    stopped = true;
    controller.abort();
    clearInterval(timer);
    unsubscribe();
    window.removeEventListener("online", poll);
  };
  const removeReset = sessionRuntime.onReset(stop);
  return () => {
    stop();
    removeReset();
  };
}
