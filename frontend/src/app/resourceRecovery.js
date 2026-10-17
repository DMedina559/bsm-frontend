import { queryClient } from "./queryClient";
import { getConnectionIdentity } from "./connection";
import { application } from "./application";
import { browserPlatform } from "./browserPlatform";

// Tasks have a session recovery owner; diagnostic intervals are explicitly opt-in.
const independentlyScheduled = new Set([
  "tasks",
  "diagnostics",
  "diagnostic-history",
  "diagnostic-runs",
  "diagnostic-trace",
]);
export function refreshActiveResources(identity, generation) {
  const keys = queryClient
    .getQueryCache()
    .findAll({ type: "active" })
    .filter((query) => {
      if (independentlyScheduled.has(query.queryKey[0])) return false;
      const scope = query.queryKey.at(-1);
      return (
        scope?.generation === generation &&
        (scope.identity === identity ||
          scope.backend === getConnectionIdentity())
      );
    })
    .map((query) => query.queryKey);
  return application.refreshResources(keys);
}
/** A single visibility-aware resource recovery owner for the mounted session. */
export function startResourceRecovery({
  identity,
  generation,
  connected,
  fallback,
}) {
  if (identity === null) return () => {};
  const session = application.sessionRuntime.capture();
  const refresh = () => {
    if (
      application.sessionRuntime.isCurrent(session) &&
      browserPlatform.isOnline() &&
      browserPlatform.isVisible()
    )
      void refreshActiveResources(identity, generation);
  };
  if (connected || fallback) refresh();
  const timer = fallback ? setInterval(refresh, 60_000) : null;
  browserPlatform.addEventListener("online", refresh);
  browserPlatform.addEventListener("visibilitychange", refresh);
  const stop = () => {
    clearInterval(timer);
    browserPlatform.removeEventListener("online", refresh);
    browserPlatform.removeEventListener("visibilitychange", refresh);
  };
  const removeReset = application.sessionRuntime.onReset(stop);
  return () => {
    stop();
    removeReset();
  };
}
