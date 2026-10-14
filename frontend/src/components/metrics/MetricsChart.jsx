import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useMetricFormat } from "../../app/useMetricFormat";
export default function MetricsChart({
  title,
  samples,
  series,
  unit,
  percent = false,
}) {
  const { number, scale, units } = useMetricFormat();
  const bytesPerUnit =
    unit === "MB" ? 1024 ** 2 : unit === "KiB/s" ? 1024 : null;
  const converted = bytesPerUnit
    ? scale(
        samples.flatMap((sample) =>
          series.map(([key]) =>
            Number.isFinite(sample[key]) ? sample[key] * bytesPerUnit : null,
          ),
        ),
        unit === "MB" ? "memory" : "rate",
      )
    : null;
  const displayUnit = converted
    ? `${converted.unit}${unit === "KiB/s" ? "/s" : ""}`
    : unit === "ms"
      ? units.duration
      : unit;
  const digits = ["tasks", "threads"].includes(unit) ? 0 : units.precision;
  const displayValue = (value) =>
    Number.isFinite(value)
      ? value *
        (converted
          ? bytesPerUnit / converted.factor
          : unit === "ms" && units.duration === "s"
            ? 1 / 1000
            : 1)
      : null;
  return (
    <section className="application-chart" aria-label={title}>
      <h2>{title}</h2>
      <div className="application-chart-key">
        {series.map(([key, label], index) => (
          <span key={key} style={{ color: `var(--bsm-chart-${index + 1})` }}>
            {label} ({displayUnit})
          </span>
        ))}
      </div>
      <div className="application-chart-canvas">
        {samples.some((sample) =>
          series.some(([key]) => Number.isFinite(sample[key])),
        ) ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <AreaChart
              data={samples}
              margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                stroke="var(--border-color)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) =>
                  new Date(value * 1000).toLocaleTimeString()
                }
                minTickGap={40}
                tick={{ fontSize: 13, fill: "var(--text-color-secondary)" }}
              />
              <YAxis
                domain={percent ? [0, 100] : [0, "auto"]}
                tick={{ fontSize: 13, fill: "var(--text-color-secondary)" }}
                tickFormatter={(value) =>
                  number(displayValue(value), "", digits)
                }
                width={48}
              />
              <Tooltip
                labelFormatter={(value) =>
                  new Date(value * 1000).toLocaleTimeString()
                }
                formatter={(value, label) => [
                  number(displayValue(value), ` ${displayUnit}`, digits),
                  label,
                ]}
                contentStyle={{
                  background: "var(--bsm-surface-raised)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                }}
              />
              {series.map(([key, label], index) => (
                <Area
                  key={key}
                  dataKey={key}
                  name={label}
                  stroke={`var(--bsm-chart-${index + 1})`}
                  fill={`var(--bsm-chart-${index + 1})`}
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="application-chart-empty">
            <p>
              {samples.length
                ? "No measurements reported for this chart."
                : "Waiting for samples…"}
            </p>
            {!!samples.length && (
              <small>
                Availability can depend on the host and process permissions.
              </small>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
