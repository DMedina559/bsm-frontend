/**
 * Tracks operation progress independently from page lifecycles.
 * Backend responses and WebSocket task snapshots remain authoritative.
 */
const TERMINAL = new Set(["completed", "complete", "success", "failed", "error", "cancelled", "canceled"]);
export function createOperationCoordinator() {
  const operations = new Map();
  const listeners = new Set();
  const notify = () => {
    const snapshot = [...operations.values()];
    listeners.forEach((listener) => listener(snapshot));
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener([...operations.values()]);
      return () => listeners.delete(listener);
    },
    get(id) { return operations.get(String(id)) ?? null; },
    list() { return [...operations.values()]; },
    register({ id, kind, serverName, status = "pending", ...extra }) {
      if (id === null || id === undefined || id === "") throw new Error("Operation ID required");
      const key = String(id);
      const previous = operations.get(key);
      const next = { ...previous, id: key, kind, serverName, status, ...extra };
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
      operations.set(key, { ...previous, status, task: data, terminal: TERMINAL.has(String(status).toLowerCase()) });
      notify();
      return true;
    },
    remove(id) {
      const removed = operations.delete(String(id));
      if (removed) notify();
      return removed;
    },
    clear() { operations.clear(); notify(); },
  };
}

export const operationCoordinator = createOperationCoordinator();
