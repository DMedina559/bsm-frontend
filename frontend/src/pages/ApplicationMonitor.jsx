import { RefreshCw, Activity } from "lucide-react";
import { useApplicationMetrics } from "../app/useApplicationMetrics";
import QueryStatus from "../components/QueryStatus";
import MetricsChart from "../components/metrics/MetricsChart";
import { metric, uptime } from "../components/metrics/format";
import "../styles/application-monitor.css";
export default function ApplicationMonitor() {
  const query = useApplicationMetrics();
  const sample = query.data?.latest;
  const samples = query.data?.history ?? [];
  const metrics = [
    ["App CPU", metric(sample?.app_cpu_percent, "%")],
    ["App memory", metric(sample?.app_ram_mb, " MB")],
    ["Threads", metric(sample?.thread_count, "", 0)],
    ["Background tasks", metric(sample?.background_task_count, "", 0)],
    ["Async tasks", metric(sample?.asyncio_task_count, "", 0)],
    ["Loop delay", metric(sample?.loop_lag_ms, " ms")],
    ["App uptime", uptime(sample?.uptime_seconds)],
    ["Host CPU", metric(sample?.sys_cpu_percent, "%")],
    [
      "Host memory",
      `${metric(sample?.sys_ram_mb, " MB")} / ${metric(sample?.sys_ram_total_mb, " MB")}`,
    ],
  ];
  return (
    <div className="container application-monitor">
      <div className="application-monitor-heading">
        <div>
          <h1>
            <Activity size={24} aria-hidden="true" /> Application Monitor
          </h1>
          <p>
            {query.isLive ? "Live" : "Polling"} ·{" "}
            {sample
              ? `Sampled ${new Date(sample.timestamp * 1000).toLocaleTimeString()}`
              : "Waiting for metrics"}
          </p>
        </div>
        <button
          type="button"
          className="action-button secondary"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>
      <QueryStatus query={query} />
      <dl className="application-metric-grid application-detail-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="application-metrics-hint">
        Recent {query.data?.history_limit ?? 180} samples, approximately every{" "}
        {query.data?.interval_seconds ?? 3} seconds. History is held in memory
        and resets when the application restarts. Process CPU can exceed 100%
        across multiple cores; host I/O covers the whole machine. Unavailable
        readings appear as —.
      </p>
      <div className="application-charts">
        <MetricsChart
          title="Application CPU"
          samples={samples}
          series={[["app_cpu_percent", "CPU"]]}
          unit="%"
        />
        <MetricsChart
          title="Application memory"
          samples={samples}
          series={[["app_ram_mb", "Memory"]]}
          unit="MB"
        />
        <MetricsChart
          title="Host utilization"
          samples={samples}
          series={[
            ["sys_cpu_percent", "CPU"],
            ["sys_ram_percent", "Memory"],
          ]}
          unit="%"
          percent
        />
        <MetricsChart
          title="Event loop delay"
          samples={samples}
          series={[["loop_lag_ms", "Delay"]]}
          unit="ms"
        />
        <MetricsChart
          title="Network throughput"
          samples={samples}
          series={[
            ["net_tx_kib_s", "Sent"],
            ["net_rx_kib_s", "Received"],
          ]}
          unit="KiB/s"
        />
        <MetricsChart
          title="Disk throughput"
          samples={samples}
          series={[
            ["disk_read_kib_s", "Read"],
            ["disk_write_kib_s", "Written"],
          ]}
          unit="KiB/s"
        />
        <MetricsChart
          title="Background tasks"
          samples={samples}
          series={[["background_task_count", "Tasks"]]}
          unit="tasks"
        />
        <MetricsChart
          title="Async tasks"
          samples={samples}
          series={[["asyncio_task_count", "Tasks"]]}
          unit="tasks"
        />
        <MetricsChart
          title="Threads"
          samples={samples}
          series={[["thread_count", "Threads"]]}
          unit="threads"
        />
      </div>
      <section className="application-server-metrics">
        <h2>Bedrock processes</h2>
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
              {sample?.servers.map((server) => (
                <tr key={server.server_name}>
                  <td>{server.server_name}</td>
                  <td>{server.pid ?? "—"}</td>
                  <td>{metric(server.cpu_percent, "%")}</td>
                  <td>{metric(server.memory_mb, " MB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!sample?.servers.length && <p>No server process metrics available.</p>}
      </section>
    </div>
  );
}
