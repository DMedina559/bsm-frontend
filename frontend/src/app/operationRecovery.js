import {
  captureStateRequest,
  reconcileResourceSnapshot,
  reconcileTaskResponse,
} from "./applicationState";
import { callOperation } from "../api/operations";
import { queryClient } from "./queryClient";
import { queryKeys } from "./queryKeys";
import { operationCoordinator } from "./operationCoordinator";
import { stateReconciler } from "./stateReconciler";
import { sessionRuntime } from "./sessionRuntime";
/** Polling is owned by the session, so navigation cannot abandon a task. */
export function startOperationRecovery(identity = null, generation = 0) {
  const session = sessionRuntime.capture();
  const controller = new AbortController();
  let stopped = false;
  let polling = false;
  const attempts = new Map();
  let cursor = 0;
  let discoveryTimer;
  let discoveryFailures = 0;
  let discovering = false;
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
            const ticket = captureStateRequest(controller.signal);
            try {
              const data = await callOperation("get_task_status", {
                path: { task_id: operation.id },
                signal: controller.signal,
              });
              if (!stopped && sessionRuntime.isCurrent(session)) {
                attempts.delete(operation.id);
                reconcileTaskResponse(
                  { ...data, id: data.id ?? operation.id },
                  ticket,
                );
              }
            } catch (error) {
              if (stopped || !sessionRuntime.isCurrent(session)) return;
              if (error.status === 404) {
                attempts.delete(operation.id);
                reconcileTaskResponse(
                  {
                    task_id: operation.id,
                    status: "unknown",
                    error: {
                      code: "task_unavailable",
                      message: "Task snapshot is unavailable",
                      details: null,
                    },
                  },
                  ticket,
                );
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
  const discover = () => {
    if (stopped || discovering || navigator.onLine === false) return;
    discovering = true;
    clearTimeout(discoveryTimer);
    void queryClient.invalidateQueries({
      queryKey: [...queryKeys.tasks(), { identity, generation }],
      refetchType: "none",
    });
    let discoveryTicket;
    return queryClient
      .fetchQuery({
        queryKey: [...queryKeys.tasks(), { identity, generation }],
        queryFn: async ({ signal }) => {
          const ticket = captureStateRequest(
            AbortSignal.any([signal, controller.signal]),
          );
          discoveryTicket = ticket;
          const data = await callOperation("list_tasks", {
            signal: AbortSignal.any([signal, controller.signal]),
          });
          return reconcileResourceSnapshot(
            "tasks",
            null,
            [...queryKeys.tasks(), { identity, generation }],
            data,
            ticket,
          );
        },
      })
      .then((tasks) => {
        if (
          stopped ||
          !sessionRuntime.isCurrent(session) ||
          !Array.isArray(tasks) ||
          !stateReconciler.current(discoveryTicket)
        )
          return;
        discoveryFailures = 0;
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
          operationCoordinator.reconcileTask(
            { type: "task_update", data: task },
            { synchronize: true },
          );
        });
      })
      .catch(() => {
        if (stopped) return;
        discoveryFailures += 1;
        discoveryTimer = setTimeout(
          discover,
          Math.min(60000, 1000 * 2 ** Math.min(discoveryFailures, 6)),
        );
      })
      .finally(() => {
        discovering = false;
      });
  };
  void discover();
  const stopEpoch = stateReconciler.onEpochChange(() => {
    attempts.clear();
    queueMicrotask(() => {
      if (!stopped) void discover();
    });
  });
  const timer = setInterval(poll, 5000);
  const unsubscribe = operationCoordinator.subscribe(poll);
  const resume = () => {
    attempts.clear();
    void discover();
    void poll();
  };
  const onConnected = () => {
    void discover();
  };
  window.addEventListener("bsm:socket-connected", onConnected);
  window.addEventListener("online", resume);
  const stop = () => {
    stopped = true;
    controller.abort();
    clearInterval(timer);
    clearTimeout(discoveryTimer);
    unsubscribe();
    stopEpoch();
    window.removeEventListener("online", resume);
    window.removeEventListener("bsm:socket-connected", onConnected);
  };
  const removeReset = sessionRuntime.onReset(stop);
  return () => {
    stop();
    removeReset();
  };
}
