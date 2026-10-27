import { useMemo } from "react";
import { usePreference } from "../app/usePreference";
import { useResourceQuery } from "../app/resourceQueries";
import { resolveDisplayTimezone, validTimezone } from "../utils/time";
import { TimeContext } from "./TimeContext";
export default function TimeProvider({ children }) {
  const query = useResourceQuery("applicationInfo", undefined, {
    refetchInterval: 30000,
  });
  const [storedMode] = usePreference("timeDisplay", "application");
  const mode = ["application", "local", "utc"].includes(storedMode)
    ? storedMode
    : "application";
  const applicationTimezone = validTimezone(query.data?.timezone)
    ? query.data.timezone
    : "UTC";
  const value = useMemo(
    () => ({
      applicationTimezone,
      timezone: resolveDisplayTimezone(mode, applicationTimezone),
      mode,
    }),
    [applicationTimezone, mode],
  );
  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}
