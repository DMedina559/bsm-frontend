import { sessionRuntime } from "./sessionRuntime";
import { getBackendIdentity } from "./backendIdentity";

export const terminalTaskStatus = (status) =>
  [
    "completed",
    "complete",
    "success",
    "failed",
    "error",
    "cancelled",
    "canceled",
  ].includes(String(status).toLowerCase());
const taskRank = (status) =>
  ({ pending: 0, queued: 0, running: 1, cancelling: 2 })[status];

/** One ordering policy for HTTP snapshots and socket events in a session. */
export function createStateReconciler() {
  let clock = 0;
  const records = new Map();
  const seen = new Set();
  const keyOf = (key) => JSON.stringify(key);
  const current = (ticket) =>
    !ticket ||
    (sessionRuntime.isCurrent(ticket.session) &&
      !ticket.session.signal.aborted &&
      !ticket.signal?.aborted &&
      ticket.backend === getBackendIdentity());
  const capture = (signal) => ({
    signal,
    clock: ++clock,
    session: sessionRuntime.capture(),
    backend: getBackendIdentity(),
  });
  const accept = (
    key,
    value,
    {
      source = "event",
      ticket,
      revision = value?.revision,
      eventId,
      transition,
    } = {},
  ) => {
    if (!current(ticket)) {
      if (source === "http")
        throw new DOMException("Session changed", "AbortError");
      return { accepted: false };
    }
    const name = keyOf(key);
    const previous = records.get(name);
    const id = typeof eventId === "string" ? `${name}:${eventId}` : null;
    if (id && seen.has(id)) return { accepted: false, ...previous };
    const versioned = Number.isFinite(revision);
    if (previous) {
      if (
        versioned &&
        Number.isFinite(previous.revision) &&
        revision <= previous.revision
      )
        return { accepted: false, ...previous };
      // A comparable newer backend revision can supersede local arrival order.
      // Without it, a response cannot replace an event received after it began,
      // or a response belonging to a later HTTP request.
      if (
        source === "http" &&
        ticket &&
        !(
          versioned &&
          Number.isFinite(previous.revision) &&
          revision > previous.revision
        ) &&
        ((previous.source === "event" && previous.clock > ticket.clock) ||
          previous.requestClock > ticket.clock)
      )
        return { accepted: false, ...previous };
      if (
        transition &&
        !transition(
          previous.value,
          value,
          versioned &&
            Number.isFinite(previous.revision) &&
            revision > previous.revision,
        )
      )
        return { accepted: false, ...previous };
    }
    const record = {
      key,
      value,
      source,
      clock: ++clock,
      requestClock: ticket?.clock ?? 0,
      revision: versioned ? revision : previous?.revision,
    };
    records.delete(name);
    records.set(name, record);
    if (records.size > 1000) records.delete(records.keys().next().value);
    if (id) {
      seen.add(id);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
    }
    return { accepted: true, ...record };
  };
  return {
    capture,
    current,
    accept,
    read: (key) => records.get(keyOf(key)),
    entries: (prefix) =>
      [...records.values()].filter((record) => record.key[0] === prefix),
    forget: (key) => records.delete(keyOf(key)),
    clear() {
      clock = 0;
      records.clear();
      seen.clear();
    },
    task(data, options) {
      const id = data?.task_id ?? data?.id;
      if (
        id == null ||
        id === "" ||
        typeof data.status !== "string" ||
        (!terminalTaskStatus(data.status) &&
          !["pending", "queued", "running", "cancelling", "unknown"].includes(
            data.status,
          ))
      )
        return { accepted: false };
      return accept(["task", String(id)], data, {
        ...options,
        transition: (previous, next, newerRevision) => {
          if (terminalTaskStatus(previous.status))
            return (
              terminalTaskStatus(next.status) &&
              (next.status === previous.status || newerRevision)
            );
          const before = taskRank(previous.status),
            after = taskRank(next.status);
          return before === undefined || after === undefined || after >= before;
        },
      });
    },
  };
}
export const stateReconciler = createStateReconciler();
sessionRuntime.onReset(() => stateReconciler.clear());
