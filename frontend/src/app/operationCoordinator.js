import { queryClient } from "./queryClient";
import { queryKeys, resourceInvalidation } from "./queryKeys";
/**
 * Tracks operation progress independently from page lifecycles.
 * Backend responses and WebSocket task snapshots remain authoritative.
 */
const TERMINAL = new Set([
  "completed",
  "complete",
  "success",
  "failed",
  "error",
  "cancelled",
  "canceled",
]);
export function createOperationCoordinator() {
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
      const nextStatus = status ?? previous?.status ?? "pending";
      const next = {
        createdAt: previous?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        ...previous,
        id: key,
        kind,
        serverName,
        status: nextStatus,
        terminal: TERMINAL.has(String(nextStatus).toLowerCase()),
        ...extra,
      };
      operations.set(key, next);
      notify();
      return next;
    },
    reconcileTask(message) {
      if (message?.type !== "task_update" || !message.data) return false;
      const data = message.data;
      const id = data.task_id ?? data.id;
      if (id === undefined || id === null || id === "") return false;
      const key = String(id);
      const previous = operations.get(key);
      if (!previous) return false;
      const status = data.status ?? previous.status;
      if (typeof status !== "string") return false;
      if (previous.terminal && !TERMINAL.has(String(status).toLowerCase()))
        return false;
      if (
        Number.isFinite(data.revision) &&
        Number.isFinite(previous.task?.revision) &&
        data.revision <= previous.task.revision
      )
        return false;
      operations.set(key, {
        ...previous,
        status,
        updatedAt: Date.now(),
        progress: data.progress ?? previous.progress,
        error: data.error ?? null,
        task: data,
        terminal: TERMINAL.has(String(status).toLowerCase()),
      });
      if (!previous.terminal && TERMINAL.has(status.toLowerCase())) {
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
      operations.clear();
      notify();
    },
  };
}

export const operationCoordinator = createOperationCoordinator();
