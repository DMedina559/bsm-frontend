import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { metric } from "./format";
export default function MetricsChart({
  title,
  samples,
  series,
  unit,
  percent = false,
}) {
  return (
    <section className="application-chart" aria-label={title}>
      <h2>{title}</h2>
      <div className="application-chart-key">
        {series.map(([key, label], index) => (
          <span key={key} style={{ color: `var(--bsm-chart-${index + 1})` }}>
            {label}
          </span>
        ))}
      </div>
      <div className="application-chart-canvas">
        {samples.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <LineChart
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
                tick={{ fontSize: 11 }}
              />
              <YAxis
                domain={percent ? [0, 100] : [0, "auto"]}
                tick={{ fontSize: 11 }}
                width={48}
              />
              <Tooltip
                labelFormatter={(value) =>
                  new Date(value * 1000).toLocaleTimeString()
                }
                formatter={(value, label) => [metric(value, ` ${unit}`), label]}
                contentStyle={{
                  background: "var(--bsm-surface-raised)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                }}
              />
              {series.map(([key, label], index) => (
                <Line
                  key={key}
                  dataKey={key}
                  name={label}
                  stroke={`var(--bsm-chart-${index + 1})`}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p>Waiting for samples…</p>
        )}
      </div>
    </section>
  );
}
