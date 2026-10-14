const labels = {
  pid: "Process ID",
  uptime_seconds: "Uptime",
  ready: "Ready",
  phase: "Lifecycle",
  last_error_type: "Last error type",
  dirty: "Pending changes",
  queued: "Queued records",
  generation: "Event generation",
  managed_tasks: "Managed tasks",
  max_pending_per_client: "Maximum pending per client",
};
export function labelFor(key) {
  return (
    labels[key] ??
    key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}
export function displayValue(value) {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}
export function dateValue(value) {
  return Number.isFinite(value) && value > 0
    ? new Date(value * 1000).toLocaleString()
    : "Not recorded";
}
export function fieldValue(key, value) {
  if (value == null) {
    if (key.endsWith("error_type")) return "No error reported";
    if (key === "stage") return "No stage reported";
    if (key === "shutdown_reason") return "No reason reported";
    if (key === "correlation_id") return "No correlation ID";
    if (key.endsWith("_at") || key === "timestamp") return "Not recorded";
    if (key === "last_drain_duration_ms")
      return "No drain measurement recorded";
    return "Not reported";
  }
  if (key === "status" && String(value).toUpperCase() === "UNKNOWN")
    return "Status not reported";
  if (key.endsWith("_at") || key === "timestamp") return dateValue(value);
  if (typeof value === "number" && key.endsWith("_seconds"))
    return `${displayValue(value)} seconds`;
  if (typeof value === "number" && key.endsWith("_ms"))
    return `${displayValue(value)} ms`;
  if (typeof value === "number" && key.endsWith("_percent"))
    return `${displayValue(value)}%`;
  return displayValue(value);
}
export const pluginStatusLabel = (value) =>
  !value || value.toUpperCase() === "UNKNOWN"
    ? "Status not reported"
    : labelFor(value.toLowerCase());
