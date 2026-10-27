import { useContext, useMemo } from "react";
import { TimeContext } from "../contexts/TimeContext";
import { formatTimestamp, timestampDetails } from "../utils/time";
export function useTimeFormat() {
  const context = useContext(TimeContext);
  return useMemo(
    () => ({
      ...context,
      format: (value, options = {}) =>
        formatTimestamp(value, { timezone: context.timezone, ...options }),
      date: (value) =>
        formatTimestamp(value, { timezone: context.timezone, kind: "date" }),
      time: (value) =>
        formatTimestamp(value, { timezone: context.timezone, kind: "time" }),
      details: timestampDetails,
    }),
    [context],
  );
}
