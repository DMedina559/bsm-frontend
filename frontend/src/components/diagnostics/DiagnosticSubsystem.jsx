import {
  Activity,
  Database,
  Network,
  Puzzle,
  Clock,
  Layers,
  Server,
  Gauge,
  Radio,
} from "lucide-react";
import DiagnosticDetails from "./DiagnosticDetails";
import PluginDiagnostics from "./PluginDiagnostics";
import Status from "./Status";
import { subsystemDescriptions } from "./subsystems";
import { dateValue, displayValue, fieldValue, labelFor } from "./format";

const icons = {
  runtime: Clock,
  events: Radio,
  state: Layers,
  storage: Database,
  tasks: Activity,
  plugins: Puzzle,
  transport: Network,
  metrics: Gauge,
  processes: Server,
};
function summaries(data) {
  switch (data.kind) {
    case "runtime":
      return [
        ["phase", data.phase],
        ["uptime_seconds", data.uptime_seconds],
        ["pid", data.pid],
        ["version", data.version],
      ];
    case "events":
      return [
        ["emitted", data.activity?.emitted],
        ["failed_listeners", data.activity?.failed_listeners],
        ["pending_workers", data.activity?.pending_workers],
        ["pending_waits", data.activity?.pending_waits],
      ];
    case "state":
      return Object.entries(data.counts ?? {}).map(([key, value]) => [
        key,
        value,
      ]);
    case "storage":
      return [
        ["successes", data.successes],
        ["failures", data.failures],
        ["active", data.active],
        ["lock_waiters", data.lock_waiters],
      ];
    case "tasks":
      return [
        ["active", data.active],
        ["capacity", data.capacity],
        ["accepting", data.accepting],
        ["oldest_active_seconds", data.oldest_active_seconds],
      ];
    case "transport":
      return [
        ["connected_clients", data.connected_clients],
        ["subscriptions", data.subscriptions],
        ["successful_sends", data.successful_sends],
        ["failed_sends", data.failed_sends],
        ["pending_sends", data.pending_sends],
        ["active_sends", data.active_sends],
      ];
    case "metrics":
      return [
        ["successes", data.successes],
        ["failures", data.failures],
        ["missed_intervals", data.missed_intervals],
        ["interval_seconds", data.interval_seconds],
      ];
    case "processes":
      return [
        ["registered", data.registered],
        [
          "observed_running",
          data.observation_available === false ? null : data.observed_running,
        ],
        ["observation_available", data.observation_available],
        ["monitor_failures", data.monitor_failures],
      ];
    case "plugin_values":
      return Object.entries(data.values ?? {}).map(([key, value]) => [
        key,
        value,
        data.units?.[key],
      ]);
    default:
      return [];
  }
}
export default function DiagnosticSubsystem({ item }) {
  const data = item.data;
  const Icon = icons[data?.kind ?? item.name] ?? Activity;
  return (
    <section
      className={`diagnostic-card${data?.kind === "plugins" ? " diagnostic-wide-card" : ""}`}
      aria-label={`${labelFor(item.name)} diagnostics`}
    >
      <header className="diagnostic-card-heading">
        <Icon size={28} aria-hidden="true" />
        <div>
          <h2>{labelFor(item.name)}</h2>
          <p className="monitor-muted">
            {subsystemDescriptions[data?.kind ?? item.name] ??
              "Provider observations"}
          </p>
        </div>
        <Status value={item.status} />
      </header>
      {item.stale && (
        <p className="diagnostic-notice">
          Stale reading: these are the last reported observations.
        </p>
      )}
      {item.issues?.map((issue) => (
        <p className="diagnostic-notice" key={issue.code}>
          {issue.message}
        </p>
      ))}
      {!data ? (
        <p>
          The provider did not return observations. Refresh to retry; review any
          collection issue shown above.
        </p>
      ) : data.kind === "plugins" ? (
        <PluginDiagnostics data={data} />
      ) : (
        <>
          <dl
            className="diagnostic-values diagnostic-key-values"
            aria-label={`${labelFor(item.name)} summary`}
          >
            {summaries(data).map(([key, value, unit]) => (
              <div key={key}>
                <dt>{labelFor(key)}</dt>
                <dd>
                  {unit && value != null
                    ? `${displayValue(value)} ${unit}`
                    : fieldValue(key, value)}
                </dd>
              </div>
            ))}
          </dl>
          {data.kind === "transport" && (
            <div className="diagnostic-capacity">
              <span>Pending sends per client</span>
              <strong>
                {fieldValue("count", data.max_pending_per_client)} /{" "}
                {fieldValue("count", data.queue_limit_per_client)}
              </strong>
              {Number.isFinite(data.max_pending_per_client) &&
                data.queue_limit_per_client > 0 && (
                  <progress
                    aria-label="Maximum pending sends per client"
                    value={data.max_pending_per_client}
                    max={data.queue_limit_per_client}
                  />
                )}
            </div>
          )}
          {data.kind === "metrics" && (
            <>
              {data.warming_up && (
                <p>
                  Collection is warming up. Rate measurements may need another
                  sample.
                </p>
              )}
              {!!data.unavailable_measurements?.length && (
                <p>
                  Not reported by the collector:{" "}
                  {data.unavailable_measurements.map(labelFor).join(", ")}.
                  Availability can depend on the host and process permissions.
                </p>
              )}
            </>
          )}
          <details className="diagnostic-technical-details">
            <summary>
              {data.kind === "transport"
                ? "Delivery details"
                : "Technical details"}
            </summary>
            <DiagnosticDetails value={data} />
          </details>
        </>
      )}
      {data?.truncated && (
        <p className="monitor-muted">
          Details were limited; totals may exceed the displayed entries.
        </p>
      )}
      <details className="diagnostic-source-details">
        <summary>Observation source and timing</summary>
        <dl className="diagnostic-values">
          <div>
            <dt>Owner</dt>
            <dd>{item.owner}</dd>
          </div>
          <div>
            <dt>Reading age at collection</dt>
            <dd>
              {Number.isFinite(item.age_seconds)
                ? `${item.age_seconds.toFixed(1)} seconds`
                : "No observation timestamp reported"}
            </dd>
          </div>
          <div>
            <dt>Last successful collection</dt>
            <dd>{dateValue(item.last_success_at)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
