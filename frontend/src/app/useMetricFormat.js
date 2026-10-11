import { usePreference } from "./usePreference";
import {
  DEFAULT_METRIC_UNITS,
  byteScale,
  formatByteValue,
} from "../utils/metricUnits";
export function useMetricFormat() {
  const [units] = usePreference("metricUnits", DEFAULT_METRIC_UNITS);
  return {
    units,
    number: (value, suffix = "", digits = units.precision) =>
      Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "—",
    duration: (ms) =>
      Number.isFinite(ms)
        ? `${(ms / (units.duration === "s" ? 1000 : 1)).toFixed(units.precision)} ${units.duration}`
        : "—",
    memory: (mib) =>
      formatByteValue(
        Number.isFinite(mib) ? mib * 1024 ** 2 : null,
        units.memory,
        units.precision,
      ),
    scale: (values, kind) =>
      byteScale(Math.max(0, ...values.filter(Number.isFinite)), units[kind]),
  };
}
