import {
  createStateReconciler,
  stateReconciler,
  terminalTaskStatus,
} from "./stateReconciler";
import { queryClient } from "./queryClient";
import { queryKeys, resourceInvalidation } from "./queryKeys";
/**
 * Tracks operation progress independently from page lifecycles.
 * Backend responses and WebSocket task snapshots remain authoritative.
 */
export function createOperationCoordinator(
  reconciler = createStateReconciler(),
) {
  const operations = new Map();
  const listeners = new Set();
  let snapshot = [];
  const notify = () => {
    const terminal = [...operations.values()].filter(
      (operation) => operation.terminal || operation.status === "unknown",
    );
    terminal
      .slice(0, Math.max(0, terminal.length - 100))
      .forEach((operation) => operations.delete(operation.id));
    snapshot = [...operations.values()];
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("Operation listener failed", error);
      }
    });
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener([...operations.values()]);
      } catch (error) {
        console.error("Operation listener failed", error);
      }
      return () => listeners.delete(listener);
    },
    get(id) {
      return operations.get(String(id)) ?? null;
    },
    list() {
      return snapshot;
    },
    register({ id, kind, serverName, status, ...extra }) {
      if (id === null || id === undefined || id === "")
        throw new Error("Operation ID required");
      const key = String(id);
      const previous = operations.get(key);
      if (!reconciler.read(["task", key]) && terminalTaskStatus(status))
        reconciler.task({ id: key, status }, { source: "local" });
      const authoritative = reconciler.read(["task", key])?.value;
      const nextStatus =
        authoritative?.status ?? status ?? previous?.status ?? "pending";
      const next = {
        createdAt: previous?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        ...previous,
        id: key,
        kind,
        serverName,
        status: nextStatus,
        terminal: terminalTaskStatus(nextStatus),
        ...extra,
        ...(authoritative
          ? {
              task: authoritative,
              error: authoritative.error ?? null,
              progress: authoritative.progress ?? previous?.progress,
            }
          : {}),
      };
      operations.set(key, next);
      notify();
      return next;
    },
    reconcileTask(message, options = {}) {
      if (message?.type !== "task_update" || !message.data) return false;
      const data = message.data;
      const id = data.task_id ?? data.id;
      if (id === undefined || id === null || id === "") return false;
      const key = String(id);
      const previous = operations.get(key);
      if (!previous) return false;
      const status = data.status ?? previous.status;
      if (typeof status !== "string") return false;
      const result = options.synchronize
        ? { accepted: false, value: reconciler.read(["task", key])?.value }
        : reconciler.task({ ...data, status }, options);
      if (!result.value || (!result.accepted && previous.task === result.value))
        return false;
      const accepted = result.value;
      const acceptedStatus = accepted.status;
      operations.set(key, {
        ...previous,
        status: acceptedStatus,
        updatedAt: Date.now(),
        progress: accepted.progress ?? previous.progress,
        error: accepted.error ?? null,
        task: accepted,
        terminal: terminalTaskStatus(acceptedStatus),
      });
      if (!previous.terminal && terminalTaskStatus(acceptedStatus)) {
        const keys = [queryKeys.tasks()];
        const kind = previous.kind ?? "background";
        const name = previous.serverName;
        if (/install|start|stop|restart|update|delete|background/.test(kind))
          keys.push(queryKeys.servers());
        if (/world|addon|export|upload|background/.test(kind))
          keys.push(queryKeys.content());
        if (name && /addon/.test(kind)) keys.push(queryKeys.serverAddons(name));
        if (name && /backup|restore/.test(kind))
          keys.push(queryKeys.serverBackups(name));
        if (name && /properties|restore/.test(kind))
          keys.push(queryKeys.serverProperties(name));
        if (name && /settings/.test(kind))
          keys.push(queryKeys.serverSettings(name));
        if (name && /start|stop|restart|update/.test(kind))
          keys.push(queryKeys.serverMonitor(name));
        if (/scan|players/.test(kind)) keys.push(queryKeys.globalPlayers());
        keys.forEach((queryKey) => {
          void queryClient.invalidateQueries(resourceInvalidation(queryKey));
        });
      }
      notify();
      return true;
    },
    acknowledge(id) {
      const operation = operations.get(String(id));
      if (!operation || operation.acknowledged) return;
      operations.set(String(id), { ...operation, acknowledged: true });
      notify();
    },
    remove(id) {
      const removed = operations.delete(String(id));
      if (removed) notify();
      return removed;
    },
    clear() {
      for (const id of operations.keys()) reconciler.forget(["task", id]);
      operations.clear();
      notify();
    },
  };
}

export const operationCoordinator = createOperationCoordinator(stateReconciler);
