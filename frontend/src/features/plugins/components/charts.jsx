import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
export const chartsComponents = {
  Chart: ({
    type = "line",
    data,
    xAxis,
    series,
    height = 300,
    className = "",
    showLegend = false,
    layout = "horizontal",
    colors = [
      "var(--bsm-info)",
      "var(--bsm-success)",
      "var(--bsm-warning)",
      "var(--bsm-chart-3)",
      "var(--bsm-chart-1)",
      "var(--bsm-chart-2)",
    ],
    nameKey = "name",
    valueKey = "value",
  }) => {
    if (type === "pie") {
      return (
        <div
          className={`chart-container ${className}`}
          style={{
            width: "100%",
            height: height,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bsm-surface-raised)",
                  border: "1px solid var(--border-color)",
                }}
                labelStyle={{
                  color: "var(--text-color-secondary)",
                }}
              />
              {showLegend && <Legend />}
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius="80%"
                fill="var(--bsm-chart-1)"
                label
              >
                {Array.isArray(data) &&
                  data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || colors[index % colors.length]}
                    />
                  ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    const ChartComponent =
      type === "area" ? AreaChart : type === "bar" ? BarChart : LineChart;
    const DataComponent = type === "area" ? Area : type === "bar" ? Bar : Line;
    const isVertical = layout === "vertical";
    return (
      <div
        className={`chart-container ${className}`}
        style={{
          width: "100%",
          height: height,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} layout={layout}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            {isVertical ? (
              <>
                <XAxis type="number" stroke="var(--text-color-secondary)" />
                <YAxis
                  dataKey={xAxis}
                  type="category"
                  stroke="var(--text-color-secondary)"
                />
              </>
            ) : (
              <>
                <XAxis dataKey={xAxis} stroke="var(--text-color-secondary)" />
                <YAxis stroke="var(--text-color-secondary)" />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bsm-surface-raised)",
                border: "1px solid var(--border-color)",
              }}
              labelStyle={{
                color: "var(--text-color-secondary)",
              }}
            />
            {showLegend && <Legend />}
            {series &&
              series.map((s, idx) => (
                <DataComponent
                  key={idx}
                  type="monotone"
                  dataKey={s.dataKey}
                  stroke={s.color}
                  fill={s.color} // For Area/Bar
                  name={s.name || s.dataKey}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    );
  },
};
