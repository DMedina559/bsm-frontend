import { useTimeFormat } from "../app/useTimeFormat";
import { parseInstant } from "../utils/time";
export default function Timestamp({
  value,
  unit = "milliseconds",
  kind = "datetime",
  timezone,
  fallback = "—",
}) {
  const { format, details } = useTimeFormat();
  const date = parseInstant(value, unit);
  if (!date) return fallback;
  return (
    <time
      className="timestamp"
      dateTime={date.toISOString()}
      title={details(value, unit)}
    >
      {format(value, {
        unit,
        kind,
        ...(timezone ? { timezone } : {}),
        fallback,
      })}
    </time>
  );
}
