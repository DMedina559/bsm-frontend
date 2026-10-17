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
export function refreshActiveResources(
  identity,
  generation,
  reason = "resource-recovery",
) {
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
  if (keys.length)
    application.diagnostics.record("refresh-request", {
      reason,
      count: keys.length,
    });
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
  const refresh = (reason) => {
    if (
      application.sessionRuntime.isCurrent(session) &&
      browserPlatform.isOnline() &&
      browserPlatform.isVisible()
    )
      void refreshActiveResources(identity, generation, reason);
  };
  if (connected || fallback)
    refresh(connected ? "socket-connected" : "http-fallback");
  const online = () => refresh("online");
  const visible = () => refresh("visible");
  const timer = fallback
    ? setInterval(() => refresh("fallback-interval"), 60_000)
    : null;
  browserPlatform.addEventListener("online", online);
  browserPlatform.addEventListener("visibilitychange", visible);
  const stop = () => {
    clearInterval(timer);
    browserPlatform.removeEventListener("online", online);
    browserPlatform.removeEventListener("visibilitychange", visible);
  };
  const removeReset = application.sessionRuntime.onReset(stop);
  return () => {
    stop();
    removeReset();
  };
}
