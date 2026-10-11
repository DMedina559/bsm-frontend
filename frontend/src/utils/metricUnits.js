export const BYTE_UNITS = {
  B: 1,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
};
export const UNIT_OPTIONS = ["auto", ...Object.keys(BYTE_UNITS)];
export const DEFAULT_METRIC_UNITS = {
  memory: "auto",
  rate: "auto",
  precision: 1,
  duration: "ms",
};
export function validMetricUnits(value) {
  return (
    value &&
    UNIT_OPTIONS.includes(value.memory) &&
    UNIT_OPTIONS.includes(value.rate) &&
    [0, 1, 2, 3].includes(value.precision) &&
    ["ms", "s"].includes(value.duration)
  );
}
export function byteScale(bytes, preference) {
  if (preference !== "auto" && BYTE_UNITS[preference])
    return { unit: preference, factor: BYTE_UNITS[preference] };
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index =
    Number.isFinite(bytes) && bytes > 0
      ? Math.min(4, Math.max(0, Math.floor(Math.log2(bytes) / 10)))
      : 0;
  return { unit: units[index], factor: BYTE_UNITS[units[index]] };
}
export function formatByteValue(
  bytes,
  preference = "auto",
  precision = 1,
  rate = false,
) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const scale = byteScale(bytes, preference);
  return `${(bytes / scale.factor).toFixed(precision)} ${scale.unit}${rate ? "/s" : ""}`;
}
