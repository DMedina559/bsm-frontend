import Timestamp from "../Timestamp";
import { useResourceQuery } from "../../app/resourceQueries";

const labels = {
  lifecycle: "Application runtime",
  database: "Database",
  state: "Application state",
  metrics: "Metrics collector",
};
export default function ApplicationHealth() {
  const query = useResourceQuery("applicationHealth", undefined, {
    refetchInterval: 30000,
    retry: false,
  });
  const label = query.error
    ? "Unavailable"
    : query.isPending
      ? "Checking"
      : query.data?.health === "healthy"
        ? "Healthy"
        : "Degraded";
  return (
    <details
      className={`application-health health-${label.toLowerCase()}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={`Connection and application health: ${label}`}
        title="API connection and application health"
      >
        <span className="application-health-dot" aria-hidden="true" />
        {query.error || query.isPending ? label : `Connected · ${label}`}
      </summary>
      <div className="application-health-popover">
        <h3>Connection and health</h3>
        {query.error ? (
          <p role="status">Health checks unavailable. Try again shortly.</p>
        ) : query.isPending ? (
          <p role="status">Checking services…</p>
        ) : (
          <ul>
            <li>
              <strong>API connection</strong>
              <span className="check-healthy">Connected</span>
            </li>
            {Object.entries(query.data?.checks ?? {}).map(([name, check]) => (
              <li key={name}>
                <strong>{labels[name] ?? name}</strong>
                <span
                  className={check.healthy ? "check-healthy" : "check-degraded"}
                >
                  {check.healthy ? "Healthy" : "Degraded"}
                </span>
                <small>{check.message}</small>
              </li>
            ))}
          </ul>
        )}
        {query.data &&
          !query.error &&
          Number.isFinite(query.data.checked_at) && (
            <span
              className="application-health-checked"
              title="Health checks refresh every 30 seconds"
            >
              Checked{" "}
              <Timestamp
                value={query.data.checked_at}
                unit="seconds"
                kind="time"
              />{" "}
              · every 30s
            </span>
          )}
        <button
          type="button"
          className="action-button secondary"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          Check again
        </button>
      </div>
    </details>
  );
}
