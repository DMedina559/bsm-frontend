/** Instants stay UTC; timezone selection belongs only to display. */
const formatters = new Map();
export function validTimezone(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function resolveDisplayTimezone(mode, applicationTimezone) {
  const zone =
    mode === "local"
      ? browserTimezone()
      : mode === "utc"
        ? "UTC"
        : applicationTimezone;
  return validTimezone(zone) ? zone : "UTC";
}
export function parseInstant(value, unit = "milliseconds") {
  if (
    value == null ||
    value === "" ||
    (typeof value !== "string" &&
      typeof value !== "number" &&
      !(value instanceof Date))
  )
    return null;
  let input = value;
  // SQLite may return historical UTC timestamps without an offset. Never interpret
  // those in the browser's local timezone. Numeric units are always explicit.
  if (typeof value === "number")
    input = value * (unit === "seconds" ? 1000 : 1);
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
  )
    input = `${value.replace(" ", "T")}Z`;
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function formatTimestamp(
  value,
  {
    timezone = "UTC",
    kind = "datetime",
    unit = "milliseconds",
    fallback = "—",
  } = {},
) {
  const date = parseInstant(value, unit);
  if (!date) return fallback;
  const options =
    kind === "date"
      ? { year: "numeric", month: "short", day: "numeric" }
      : kind === "time"
        ? {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
          }
        : {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          };
  const key = `${timezone}:${kind}`;
  if (!formatters.has(key)) {
    if (formatters.size >= 128)
      formatters.delete(formatters.keys().next().value);
    formatters.set(
      key,
      new Intl.DateTimeFormat(undefined, {
        ...options,
        timeZone: validTimezone(timezone) ? timezone : "UTC",
      }),
    );
  }
  return formatters.get(key).format(date);
}
export function timestampDetails(value, unit) {
  const date = parseInstant(value, unit);
  if (!date) return "";
  const utc = date.toISOString();
  return typeof value === "string" && value !== utc
    ? `UTC: ${utc}\nOriginal: ${value}`
    : `UTC: ${utc}`;
}
