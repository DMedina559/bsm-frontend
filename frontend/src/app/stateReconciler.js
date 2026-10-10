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
  let epoch = null;
  let epochGeneration = 0;
  const retiredEpochs = new Set();
  const tickets = new WeakMap();
  const epochListeners = new Set();
  const records = new Map();
  const seen = new Set();
  const keyOf = (key) => JSON.stringify(key);
  const current = (ticket) =>
    !ticket ||
    (sessionRuntime.isCurrent(ticket.session) &&
      !ticket.session.signal.aborted &&
      !ticket.signal?.aborted &&
      ticket.backend === getBackendIdentity() &&
      tickets.get(ticket)?.generation === epochGeneration);
  const capture = (signal) => {
    const ticket = {
      signal,
      clock: ++clock,
      session: sessionRuntime.capture(),
      backend: getBackendIdentity(),
    };
    tickets.set(ticket, { generation: epochGeneration, observedEpoch: null });
    return ticket;
  };
  const observeEpoch = (incoming, ticket, source) => {
    if (typeof incoming !== "string" || !incoming) return true;
    const binding = ticket && tickets.get(ticket);
    if (
      retiredEpochs.has(incoming) ||
      (binding?.observedEpoch && binding.observedEpoch !== incoming)
    ) {
      if (source === "http")
        throw new DOMException("Backend instance changed", "AbortError");
      return false;
    }
    if (incoming !== epoch) {
      const previous = epoch;
      epoch = incoming;
      if (previous !== null) {
        retiredEpochs.add(previous);
        epochGeneration += 1;
        records.clear();
        seen.clear();
        // The observation discovering a restart belongs to the new instance.
        // Every other in-flight request and socket belongs to the old generation.
        if (binding) binding.generation = epochGeneration;
        for (const listener of epochListeners)
          listener({ epoch, previous, ticket });
      }
    }
    if (binding) binding.observedEpoch = incoming;
    return true;
  };
  const accept = (
    key,
    value,
    {
      source = "event",
      ticket,
      revision = value?.revision,
      epoch: incomingEpoch = value?.epoch,
      eventId,
      transition,
    } = {},
  ) => {
    if (!current(ticket)) {
      if (source === "http")
        throw new DOMException("Session changed", "AbortError");
      return { accepted: false };
    }
    const hasRevision = Number.isSafeInteger(revision) && revision > 0;
    if (
      incomingEpoch != null &&
      (typeof incomingEpoch !== "string" || !incomingEpoch || !hasRevision)
    ) {
      if (source === "http") throw new Error("Invalid backend state revision");
      return { accepted: false };
    }
    if (!observeEpoch(incomingEpoch, ticket, source))
      return { accepted: false };
    const name = keyOf(key);
    const previous = records.get(name);
    const id = typeof eventId === "string" ? `${name}:${eventId}` : null;
    if (id && seen.has(id)) return { accepted: false, ...previous };
    if (previous) {
      if (
        hasRevision &&
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
          hasRevision &&
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
          hasRevision &&
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
      revision: hasRevision ? revision : previous?.revision,
      epoch,
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
    onEpochChange(listener) {
      epochListeners.add(listener);
      return () => epochListeners.delete(listener);
    },
    accept,
    read: (key) => records.get(keyOf(key)),
    entries: (prefix) =>
      [...records.values()].filter((record) => record.key[0] === prefix),
    forget: (key) => records.delete(keyOf(key)),
    clear() {
      clock = 0;
      epoch = null;
      epochGeneration += 1;
      retiredEpochs.clear();
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
