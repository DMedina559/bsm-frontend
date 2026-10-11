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
      <div className="application-summary-groups">
        {[
          [
            "Application",
            [
              ["CPU", metric(sample?.app_cpu_percent, "%")],
              ["Memory", metric(sample?.app_ram_mb, " MB")],
              [
                "Background tasks",
                metric(sample?.background_task_count, "", 0),
              ],
            ],
          ],
          [
            "System",
            [
              ["CPU", metric(sample?.sys_cpu_percent, "%")],
              ["Memory", metric(sample?.sys_ram_percent, "%")],
              ["Used memory", metric(sample?.sys_ram_mb, " MB")],
            ],
          ],
        ].map(([title, metrics]) => (
          <section key={title} aria-label={`${title} metrics`}>
            <h3>{title}</h3>
            <dl className="application-metric-grid">
              {metrics.map(([label, value]) => (
                <div
                  key={label}
                  title={
                    label === "Background tasks"
                      ? "Unfinished managed operations, including plugin tasks. Infrastructure async tasks are excluded."
                      : undefined
                  }
                >
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {query.error && (
        <p className="application-metrics-hint">
          Metrics unavailable{sample ? " · showing last sample" : ""}
        </p>
      )}
    </section>
  );
}
