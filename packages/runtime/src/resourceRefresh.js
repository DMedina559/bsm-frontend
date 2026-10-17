import { defaultScheduler } from "./scheduler.js";

/** Coalesce recovery without allowing queued work to cross a session/epoch. */
/** @param {{ queryClient: import("./contracts.js").QueryClient, stateReconciler: import("./contracts.js").StateReconciler, resourceInvalidation: typeof import("./queryKeys.js").resourceInvalidation, scheduler?: import("./contracts.js").RuntimeScheduler, logger: import("./contracts.js").Logger, diagnostics?: import("./index.js").RuntimeDiagnostics }} dependencies */
export function createResourceRefresh({
  queryClient,
  stateReconciler,
  resourceInvalidation,
  scheduler = defaultScheduler,
  logger,
  diagnostics,
}) {
  const pending = new Map();
  let scheduled = false;
  /** @param {import("./contracts.js").QueryKey[]} keys @param {() => void} [afterCancel] */
  const refreshResources = (keys, afterCancel) =>
    Promise.all(
      keys.map((key) => {
        const id = JSON.stringify(key);
        let job = pending.get(id);
        if (!job || !stateReconciler.current(job.ticket)) {
          job?.resolvers.forEach((resolve) => resolve());
          job = {
            key,
            ticket: stateReconciler.capture(),
            callbacks: new Set(),
            resolvers: [],
          };
          pending.set(id, job);
        }
        if (afterCancel) job.callbacks.add(afterCancel);
        const result = new Promise((resolve) => job.resolvers.push(resolve));
        if (!scheduled) {
          scheduled = true;
          scheduler.queueMicrotask(() => {
            scheduled = false;
            const jobs = [...pending.values()];
            pending.clear();
            for (const entry of jobs)
              void (async () => {
                try {
                  if (!stateReconciler.current(entry.ticket)) return;
                  diagnostics?.record("refresh", {
                    family: [
                      "servers",
                      "monitor",
                      "tasks",
                      "content",
                      "application-health",
                      "application-metrics",
                    ].includes(String(entry.key[0]))
                      ? String(entry.key[0])
                      : "other",
                    reason: "recovery-or-event",
                  });
                  const filter = resourceInvalidation(entry.key);
                  await queryClient.cancelQueries(filter);
                  if (!stateReconciler.current(entry.ticket)) return;
                  entry.callbacks.forEach((callback) => callback());
                  await queryClient.invalidateQueries(filter);
                } catch (error) {
                  logger.warn("Resource refresh failed", { error });
                } finally {
                  entry.resolvers.forEach((resolve) => resolve());
                }
              })();
          });
        }
        return result;
      }),
    );
  return { refreshResources };
}
