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
  const attempts = new Map();
  let cursor = 0;
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
      const pending = operationCoordinator
        .list()
        .filter(
          (operation) => !operation.terminal && operation.status !== "unknown",
        );
      const eligible = pending.filter(
        (operation) => (attempts.get(operation.id)?.next ?? 0) <= Date.now(),
      );
      const work = eligible.length
        ? [
            ...eligible.slice(cursor % eligible.length),
            ...eligible.slice(0, cursor % eligible.length),
          ]
        : [];
      cursor += 4;
      // Four workers bound concurrent requests; backoff is tracked per task.
      let index = 0;
      await Promise.allSettled(
        Array.from({ length: Math.min(4, work.length) }, async () => {
          while (
            !stopped &&
            sessionRuntime.isCurrent(session) &&
            index < work.length
          ) {
            const operation = work[index++];
            try {
              const data = await get(
                `/api/tasks/status/${encodeURIComponent(operation.id)}`,
                { signal: controller.signal },
              );
              if (!stopped && sessionRuntime.isCurrent(session)) {
                attempts.delete(operation.id);
                operationCoordinator.reconcileTask({
                  type: "task_update",
                  data: { ...data, task_id: operation.id },
                });
              }
            } catch (error) {
              if (stopped || !sessionRuntime.isCurrent(session)) return;
              if (error.status === 404) {
                attempts.delete(operation.id);
                operationCoordinator.reconcileTask({
                  type: "task_update",
                  data: {
                    task_id: operation.id,
                    status: "unknown",
                    error: "Task snapshot is unavailable",
                  },
                });
              } else {
                const failures =
                  (attempts.get(operation.id)?.failures ?? 0) + 1;
                const delay = Math.min(
                  60000,
                  5000 * 2 ** Math.min(failures, 4),
                );
                attempts.set(operation.id, {
                  failures,
                  next: Date.now() + delay * (0.8 + Math.random() * 0.4),
                });
              }
            }
          }
        }),
      );
      for (const id of attempts.keys())
        if (!pending.some((operation) => operation.id === id))
          attempts.delete(id);
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
  const resume = () => {
    attempts.clear();
    void poll();
  };
  window.addEventListener("online", resume);
  const stop = () => {
    stopped = true;
    controller.abort();
    clearInterval(timer);
    unsubscribe();
    window.removeEventListener("online", resume);
  };
  const removeReset = sessionRuntime.onReset(stop);
  return () => {
    stop();
    removeReset();
  };
}
