import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { useApplicationMetrics } from "../../app/useApplicationMetrics";
import { metric } from "./format";
import "../../styles/application-monitor.css";
export default function ApplicationMetricsSummary() {
  const query = useApplicationMetrics();
  const sample = query.data?.latest;
  return (
    <section
      className="application-summary"
      aria-label="Application performance"
    >
      <div className="application-summary-heading">
        <h2>
          <Activity size={16} aria-hidden="true" /> Application
        </h2>
        <Link to="/application-monitor">View monitor</Link>
      </div>
      <dl className="application-metric-grid">
        {[
          ["App CPU", metric(sample?.app_cpu_percent, "%")],
          ["App memory", metric(sample?.app_ram_mb, " MB")],
          ["Host memory", metric(sample?.sys_ram_percent, "%")],
          ["Loop delay", metric(sample?.loop_lag_ms, " ms")],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {query.error && (
        <p className="application-metrics-hint">
          Metrics unavailable{sample ? " · showing last sample" : ""}
        </p>
      )}
    </section>
  );
}
