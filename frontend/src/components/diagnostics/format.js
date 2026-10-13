const labels = {
  pid: "Process ID",
  uptime_seconds: "Uptime",
  ready: "Ready",
  phase: "Lifecycle",
  last_error_type: "Last error type",
  dirty: "Pending changes",
  queued: "Queued records",
};
export function labelFor(key) {
  return (
    labels[key] ??
    key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}
export function displayValue(value) {
  if (value === null || value === undefined) return "Unavailable";
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
    : "Unavailable";
}
