/** @param {Parameters<typeof import("./stateReconciler.d.ts").createStateReconcilerModule>[0]} dependencies
 * @returns {ReturnType<typeof import("./stateReconciler.d.ts").createStateReconcilerModule>} */
export function createStateReconcilerModule({
  logger,
  sessionRuntime,
  getBackendIdentity,
  diagnostics,
}) {
  const terminalTaskStatus = (status) =>
    [
      "completed",
      "complete",
      "success",
      "failed",
      "error",
      "cancelled",
      "canceled",
    ].includes(String(status).toLowerCase());
  const validTaskSnapshot = (data) => {
    const id = data?.task_id ?? data?.id;
    return Boolean(
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      ((typeof id === "string" && id.trim()) ||
        (typeof id === "number" && Number.isSafeInteger(id))) &&
      typeof data.status === "string" &&
      (terminalTaskStatus(data.status) ||
        ["pending", "queued", "running", "cancelling", "unknown"].includes(
          data.status,
        )) &&
      ((data.revision == null && data.epoch == null) ||
        (Number.isSafeInteger(data.revision) &&
          data.revision > 0 &&
          typeof data.epoch === "string" &&
          data.epoch.trim())),
    );
  };
  const taskRank = (status) =>
    ({ pending: 0, queued: 0, running: 1, cancelling: 2 })[status];

  /** One ordering policy for HTTP snapshots and socket events in a session. */
  function createStateReconciler() {
    let clock = 0;
    let epoch = null;
    let epochGeneration = 0;
    const retiredEpochs = new Set();
    const tickets = new WeakMap();
    const epochListeners = new Set();
    const records = new Map();
    const compactable = new Set();
    const observers = new Set();
    const observe = (record) => {
      for (const listener of observers) {
        try {
          listener(record);
        } catch {
          /* An observer cannot interrupt acceptance. */
        }
      }
    };
    const reject = (reason, previous = {}) => {
      diagnostics?.record("rejected", { reason });
      return { accepted: false, ...previous };
    };
    const cachedQueries = new Set();
    const seen = new Set();
    const taskPayloads = new Set();
    const releaseTaskPayload = (id) => {
      const name = keyOf(["task", String(id)]);
      const record = records.get(name);
      if (
        record &&
        (terminalTaskStatus(record.value.status) ||
          record.value.status === "unknown")
      ) {
        record.value = {
          ...record.value,
          result: null,
          error: record.value.error
            ? { ...record.value.error, details: null }
            : null,
        };
        record.payloadReleased = true;
        taskPayloads.delete(name);
        compactable.add(name);
      }
    };
    // Preserve ordering records, task identity/status and epoch tombstones. Only
    // disposable payloads are compacted; no replay window is weakened by age.
    const compact = () => {
      let compacted = 0;
      for (const name of compactable) {
        const record = records.get(name);
        if (!record) continue;
        if (record.key[0] === "event" && record.value !== null) {
          record.value = null;
          compacted += 1;
        }
        if (
          record.key[0] === "task" &&
          !taskPayloads.has(name) &&
          (terminalTaskStatus(record.value.status) ||
            record.value.status === "unknown")
        ) {
          record.value = {
            id: record.value.id,
            task_id: record.value.task_id,
            status: record.value.status,
          };
          record.payloadReleased = true;
          compacted += 1;
        }
      }
      compactable.clear();
      if (compacted) diagnostics?.record("compacted", { count: compacted });
      return { records: records.size, payloads: taskPayloads.size, compacted };
    };
    let acceptedCount = 0;
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
          compactable.clear();
          cachedQueries.clear();
          taskPayloads.clear();
          seen.clear();
          // The observation discovering a restart belongs to the new instance.
          // Every other in-flight request and socket belongs to the old generation.
          if (binding) binding.generation = epochGeneration;
          for (const listener of epochListeners) {
            try {
              listener({ epoch, previous, ticket });
            } catch (error) {
              logger.error("Epoch reset listener failed", { error });
            }
          }
        }
      }
      if (binding) binding.observedEpoch = incoming;
      return true;
    };
    /** @param {unknown[]} key @param {any} value @param {import("./contracts.js").ReconcileOptions<any>} [options] */
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
        return reject("retired-context");
      }
      const hasRevision = Number.isSafeInteger(revision) && revision > 0;
      if (
        (revision != null || incomingEpoch != null) &&
        (typeof incomingEpoch !== "string" ||
          !incomingEpoch.trim() ||
          !hasRevision)
      ) {
        if (source === "http")
          throw new Error("Invalid backend state revision");
        return reject("invalid-revision");
      }
      if (!observeEpoch(incomingEpoch, ticket, source))
        return reject("retired-epoch");
      const name = keyOf(key);
      const previous = records.get(name);
      const id = typeof eventId === "string" ? `${name}:${eventId}` : null;
      if (id && seen.has(id)) return reject("duplicate-event", previous);
      if (previous) {
        if (Number.isFinite(previous.revision) && !hasRevision)
          return reject("missing-revision", previous);
        // Only a full HTTP task snapshot may reload a released payload at the
        // same revision. It cannot alter task identity or terminal status.
        if (
          key[0] === "task" &&
          previous.payloadReleased &&
          source === "http" &&
          hasRevision &&
          revision === previous.revision &&
          incomingEpoch === previous.epoch &&
          value.status === previous.value.status &&
          (value.id ?? value.task_id) ===
            (previous.value.id ?? previous.value.task_id) &&
          Object.hasOwn(value, "result") &&
          Object.hasOwn(value, "error") &&
          Object.hasOwn(value, "message")
        ) {
          previous.value = {
            ...previous.value,
            ...value,
          };
          previous.payloadReleased = false;
          taskPayloads.add(name);
          while (taskPayloads.size > 100)
            releaseTaskPayload(
              JSON.parse(taskPayloads.values().next().value)[1],
            );
          observe({ ...previous, source });
          return { accepted: true, ...previous };
        }
        if (
          hasRevision &&
          Number.isFinite(previous.revision) &&
          revision <= previous.revision
        )
          return reject("stale-revision", previous);
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
          return reject("stale-response", previous);
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
          return reject("invalid-transition", previous);
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
      if (key[0] === "event") compactable.add(name);
      if (
        key[0] === "task" &&
        (terminalTaskStatus(value.status) || value.status === "unknown")
      ) {
        taskPayloads.delete(name);
        taskPayloads.add(name);
        while (taskPayloads.size > 100)
          releaseTaskPayload(JSON.parse(taskPayloads.values().next().value)[1]);
      }
      // Only expendable query snapshots participate in LRU eviction. Resource
      // watermarks and terminal tasks protect against replays until session/epoch reset.
      if (key[0] === "query") {
        cachedQueries.delete(name);
        cachedQueries.add(name);
        if (cachedQueries.size > 1000) {
          const oldest = cachedQueries.values().next().value;
          cachedQueries.delete(oldest);
          records.delete(oldest);
        }
      }
      if (id) {
        seen.add(id);
        if (seen.size > 1000) seen.delete(seen.values().next().value);
      }
      const acceptedValue = record.value;
      observe(record);
      if (++acceptedCount % 250 === 0) compact();
      return { accepted: true, ...record, value: acceptedValue };
    };
    return {
      compact,
      onObservation(listener) {
        observers.add(listener);
        return () => observers.delete(listener);
      },
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
      releaseTaskPayload,
      forget: (key) => {
        compactable.delete(keyOf(key));
        taskPayloads.delete(keyOf(key));
        cachedQueries.delete(keyOf(key));
        return records.delete(keyOf(key));
      },
      clear() {
        acceptedCount = 0;
        clock = 0;
        epoch = null;
        epochGeneration += 1;
        retiredEpochs.clear();
        records.clear();
        compactable.clear();
        cachedQueries.clear();
        taskPayloads.clear();
        seen.clear();
      },
      task(data, options) {
        const id = data?.task_id ?? data?.id;
        if (
          !validTaskSnapshot({
            ...data,
            revision: options?.revision ?? data?.revision,
            epoch: options?.epoch ?? data?.epoch,
          })
        )
          return reject("invalid-task");
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
            return (
              before === undefined || after === undefined || after >= before
            );
          },
        });
      },
    };
  }
  const stateReconciler = createStateReconciler();
  sessionRuntime.onReset(() => stateReconciler.clear());

  return {
    terminalTaskStatus,
    validTaskSnapshot,
    createStateReconciler,
    stateReconciler,
  };
}
