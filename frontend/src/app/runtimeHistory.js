/** Account/backend-scoped, bounded history. Persist only fixed policy labels. */
export const RUNTIME_HISTORY_LIMIT = 1000;
export const RUNTIME_HISTORY_AGE = 7 * 24 * 60 * 60 * 1000;
const types = new Set(["rejected", "compacted", "refresh-request", "refresh"]);
const reasons = new Set([
  "retired-context",
  "invalid-revision",
  "retired-epoch",
  "duplicate-event",
  "missing-revision",
  "stale-revision",
  "stale-response",
  "invalid-transition",
  "invalid-task",
  "malformed-frame",
  "task-terminal",
  "backend-event",
  "recovery-or-event",
]);
const families = new Set([
  "servers",
  "monitor",
  "tasks",
  "content",
  "application-health",
  "application-metrics",
  "other",
]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const sanitize = (row, now, session) => {
  if (
    !row ||
    !Number.isFinite(row.at) ||
    row.at < now - RUNTIME_HISTORY_AGE ||
    row.at > now + 60000 ||
    !types.has(row.type) ||
    !uuid.test(session)
  )
    return null;
  return {
    at: row.at,
    type: row.type,
    session,
    ...(reasons.has(row.reason) ? { reason: row.reason } : {}),
    ...(families.has(row.family) ? { family: row.family } : {}),
    ...(Number.isInteger(row.count) && row.count >= 0 && row.count <= 1000000
      ? { count: row.count }
      : {}),
  };
};
// An observation session ID is a label, not a credential. randomUUID is absent
// on some HTTP hosts; keep diagnostics usable there without security assumptions.
const newSession = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    return (value === "x" ? random : (random & 3) | 8).toString(16);
  });
export function createRuntimeHistory({
  diagnostics,
  storage,
  now = Date.now,
  session = newSession(),
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let identity = null,
    key = null,
    persistent = false,
    pending = null,
    stop = () => {};
  let seen = new WeakSet();
  let snapshot = { events: [], session, persistence: "memory" };
  const listeners = new Set();
  const publish = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* Isolate views. */
      }
    });
  };
  const prune = (events) =>
    events
      .filter((row) => row.at >= now() - RUNTIME_HISTORY_AGE)
      .slice(-RUNTIME_HISTORY_LIMIT);
  const flush = () => {
    if (pending !== null) cancel(pending);
    pending = null;
    if (!key || !persistent) return;
    try {
      if (!storage) throw new Error("Storage unavailable");
      storage.setItem(
        key,
        JSON.stringify({ version: 1, events: prune(snapshot.events) }),
      );
      if (snapshot.persistence !== "saved") publish({ persistence: "saved" });
    } catch {
      if (snapshot.persistence !== "unavailable")
        publish({ persistence: "unavailable" });
    }
  };
  const queue = () => {
    if (persistent && pending === null) pending = schedule(flush, 250);
  };
  const capture = () => {
    if (identity === null) return;
    const added = [];
    for (const event of diagnostics.getSnapshot().events) {
      if (seen.has(event)) continue;
      seen.add(event);
      const row = sanitize(event, now(), session);
      if (row) added.push(row);
    }
    const events = prune([...snapshot.events, ...added]);
    if (added.length || events.length !== snapshot.events.length) {
      publish({ events });
      queue();
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(nextIdentity, persist = false) {
      stop();
      flush();
      diagnostics.setEnabled(false);
      diagnostics.clear();
      identity = nextIdentity;
      key =
        identity === null
          ? null
          : `bsm:${encodeURIComponent(identity)}:runtime-history:v1`;
      persistent = Boolean(key && persist);
      seen = new WeakSet();
      let events = [],
        persistence = persistent ? "saved" : "memory";
      if (persistent) {
        try {
          if (!storage) throw new Error("Storage unavailable");
          const raw = storage.getItem(key);
          if (raw && raw.length > 512000)
            throw new Error("History exceeds limit");
          const data = raw ? JSON.parse(raw) : null;
          if (data?.version === 1 && Array.isArray(data.events))
            events = prune(
              data.events
                .slice(-RUNTIME_HISTORY_LIMIT)
                .map((row) => sanitize(row, now(), row?.session))
                .filter(Boolean),
            );
        } catch {
          persistence = "unavailable";
        }
      }
      publish({ events, persistence });
      stop = diagnostics.subscribe(capture);
      if (persistent && persistence !== "unavailable") flush();
    },
    setPersistent(enabled) {
      persistent = Boolean(identity !== null && enabled);
      if (persistent) flush();
      else {
        if (pending !== null) cancel(pending);
        pending = null;
        try {
          if (key) storage?.removeItem(key);
          publish({ persistence: "memory" });
        } catch {
          publish({ persistence: "unavailable" });
        }
      }
    },
    clear() {
      diagnostics.clear();
      seen = new WeakSet();
      publish({ events: [] });
      flush();
    },
    prune: capture,
    flush,
    close() {
      stop();
      flush();
      diagnostics.setEnabled(false);
      diagnostics.clear();
      identity = null;
      key = null;
      persistent = false;
      publish({ events: [], persistence: "memory" });
    },
    export() {
      return {
        version: 1,
        exported_at: new Date(now()).toISOString(),
        events: prune(snapshot.events).map(({ session: source, ...row }) => ({
          ...row,
          session: source === session ? "current" : "previous",
        })),
      };
    },
  };
}
