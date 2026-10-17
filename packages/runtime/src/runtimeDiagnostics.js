/** Bounded, payload-free frontend observations. Never records identities or values. */
/** @returns {import("./index.js").RuntimeDiagnostics} */
export function createRuntimeDiagnostics(limit = 200) {
  let snapshot = {
    enabled: false,
    events: [],
    subscriptions: 0,
    references: 0,
  };
  const listeners = new Set();
  const publish = (patch) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* Observers cannot interrupt runtime policy. */
      }
    });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setEnabled(enabled) {
      publish({ enabled: Boolean(enabled), events: [] });
    },
    record(type, { reason, family, count } = {}) {
      if (!snapshot.enabled) return;
      // Callers supply static policy labels, never frames, URLs, query keys or errors.
      publish({
        events: [
          ...snapshot.events,
          { at: Date.now(), type, reason, family, count },
        ].slice(-limit),
      });
    },
    subscriptions(subscriptions, references) {
      publish({ subscriptions, references });
    },
    clear() {
      publish({ events: [] });
    },
  };
}
