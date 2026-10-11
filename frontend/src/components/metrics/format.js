export function metric(value, unit = "", digits = 1) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${unit}` : "—";
}
export function uptime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}
