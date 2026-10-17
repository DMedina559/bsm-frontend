import { application } from "./application";

/** Attach explicit command context after the response passes its session fence. */
export function trackCommandResult(
  result,
  { ticket, kind, serverName, affectedKeys = [] },
) {
  if (!application.stateReconciler.current(ticket))
    throw new DOMException("Session changed", "AbortError");
  if (result && typeof result === "object" && result.task_id != null) {
    if (typeof result.task_id !== "string" || !result.task_id.trim())
      throw new Error("Invalid task ID in command response");
    application.operationCoordinator.register({
      id: String(result.task_id),
      kind,
      affectedKeys,
      ...(typeof serverName === "string" ? { serverName } : {}),
    });
  }
  return result;
}
