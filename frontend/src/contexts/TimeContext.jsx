import { createContext } from "react";
export const TimeContext = createContext({
  applicationTimezone: "UTC",
  timezone: "UTC",
  mode: "application",
});
