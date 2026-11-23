import { useTimeFormat } from "../../app/useTimeFormat";
import { useState } from "react";
import { useMetricFormat } from "../../app/useMetricFormat";
import {
  RefreshCw,
  Pause,
  Play,
  Cpu,
  MemoryStick,
  Clock,
  Timer,
} from "lucide-react";
import { useApplicationMetrics } from "../../app/useApplicationMetrics";
import QueryStatus from "../QueryStatus";
import MetricsChart from "./MetricsChart";
import MonitorNavigation from "./MonitorNavigation";
import { uptime } from "./format";
import "../../styles/application-monitor.css";

const chartGroups = {
  performance: [
    ["Application CPU", [["app_cpu_percent", "CPU"]], "%"],
    ["Application Memory", [["app_ram_mb", "Memory"]], "MB"],
  ],
  host: [
    [
      "Host Utilization",
      [
        ["sys_cpu_percent", "CPU"],
        ["sys_ram_percent", "Memory"],
      ],
      "%",
      true,
    ],
    [
      "Network Throughput",
      [
        ["net_tx_kib_s", "Sent"],
        ["net_rx_kib_s", "Received"],
      ],
      "KiB/s",
    ],
    [
      "Disk Throughput",
      [
        ["disk_read_kib_s", "Read"],
        ["disk_write_kib_s", "Written"],
      ],
      "KiB/s",
    ],
  ],
  runtime: [
    ["Event Loop Delay", [["loop_lag_ms", "Delay"]], "ms"],
    ["Background Tasks", [["background_task_count", "Tasks"]], "tasks"],
    ["Async Tasks", [["asyncio_task_count", "Tasks"]], "tasks"],
    ["Threads", [["thread_count", "Threads"]], "threads"],
  ],
};
export default function ApplicationMetrics() {
  const { format } = useTimeFormat();
  const [view, setView] = useState("performance");
  const [paused, setPaused] = useState(null);
  const query = useApplicationMetrics(paused === null);
  const { memory, duration, number: metric } = useMetricFormat();
  const data = paused ?? query.data;
  const sample = data?.latest;
  const samples = data?.history ?? [];
  const summary = [
    ["CPU usage", metric(sample?.app_cpu_percent, "%"), Cpu],
    ["Memory", memory(sample?.app_ram_mb), MemoryStick],
    ["Uptime", uptime(sample?.uptime_seconds), Clock],
    [
      "Collection Interval",
      Number.isFinite(data?.interval_seconds)
        ? `${data.interval_seconds} seconds`
        : "—",
      Timer,
    ],
  ];
  const details = [
    ["Threads", metric(sample?.thread_count, "", 0)],
    ["Background Tasks", metric(sample?.background_task_count, "", 0)],
    ["Async Tasks", metric(sample?.asyncio_task_count, "", 0)],
    ["Loop Delay", duration(sample?.loop_lag_ms)],
    ["Host CPU", metric(sample?.sys_cpu_percent, "%")],
    [
      "Host Memory",
      `${memory(sample?.sys_ram_mb)} / ${memory(sample?.sys_ram_total_mb)}`,
    ],
  ];
  return (
    <div className="application-metrics-view">
      <div className="monitor-live-strip">
        <div>
          <h2 className="monitor-view-title">Application Metrics</h2>
          <span className="monitor-live-state">
            <span
              className={`monitor-live-dot${paused ? " is-paused" : ""}`}
              aria-hidden="true"
            />
            {paused
              ? "View paused"
              : query.isLive
                ? "Live updates"
                : "Polling updates"}
          </span>
          <span className="monitor-muted">
            {sample
              ? `Sampled ${format(sample.timestamp * 1000, { kind: "time" })}`
              : "Waiting for metrics"}
          </span>
        </div>
        <div className="diagnostic-actions">
          <button
            type="button"
            className="action-button secondary"
            disabled={!data}
            onClick={() => setPaused(paused ? null : structuredClone(data))}
          >
            {paused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
            {paused ? "Resume updates" : "Pause updates"}
          </button>
          <button
            type="button"
            className="action-button secondary"
            disabled={!!paused || query.isFetching}
            onClick={() => query.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>
      <QueryStatus query={query} />
      <dl className="application-metric-grid monitor-resource-summary">
        {summary.map(([label, value, Icon]) => (
          <div key={label}>
            <Icon size={28} aria-hidden="true" />
            <div>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="monitor-muted">
        Application, host and server measurements stay separate. A dash means no
        measurement was reported.
      </p>
      <MonitorNavigation
        label="Metric categories"
        active={view}
        onChange={setView}
        items={[
          ["performance", "Application"],
          ["host", "Host"],
          ["runtime", "Runtime"],
          ["servers", "Bedrock Processes"],
        ]}
      />
      {view !== "servers" && (
        <>
          <p className="monitor-muted">
            {view === "host"
              ? "Host utilization and I/O cover the whole machine."
              : view === "runtime"
                ? "Task, thread and event-loop observations for the application."
                : "Recent observations. Process CPU may exceed 100% across multiple cores."}
          </p>
          <div className="application-charts">
            {chartGroups[view].map(([title, series, unit, percent]) => (
              <MetricsChart
                key={title}
                title={title}
                samples={samples}
                series={series}
                unit={unit}
                percent={percent}
              />
            ))}
          </div>
        </>
      )}
      {view === "servers" && (
        <section className="monitor-panel application-server-metrics">
          <h2>Bedrock Processes</h2>
          <p className="monitor-muted">
            Readings are available for observed server processes. Stopped or
            inaccessible processes may have no measurements.
          </p>
          <div className="table-responsive-wrapper">
            <table className="server-table">
              <thead>
                <tr>
                  <th>Server</th>
                  <th>PID</th>
                  <th>CPU</th>
                  <th>Memory</th>
                </tr>
              </thead>
              <tbody>
                {sample?.servers?.map((server) => (
                  <tr key={server.server_name}>
                    <td>{server.server_name}</td>
                    <td>{server.pid ?? "—"}</td>
                    <td>{metric(server.cpu_percent, "%")}</td>
                    <td>{memory(server.memory_mb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!sample?.servers?.length && (
            <p>No server process metrics reported.</p>
          )}
        </section>
      )}
      <section className="monitor-panel" aria-label="Runtime measurements">
        <h2>Runtime Details</h2>
        <dl className="monitor-detail-grid">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="monitor-muted">
          Up to {data?.history_limit ?? 180} recent samples are held in backend
          memory and reset when the application restarts. Pausing freezes this
          view; backend collection continues.
        </p>
      </section>
    </div>
  );
}
