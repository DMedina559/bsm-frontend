import { useResourceQuery } from "../../app/resourceQueries";

const labels = {
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
      <summary aria-label={`Application health: ${label}`}>{label}</summary>
      <div className="application-health-popover">
        <h3>Application health</h3>
        {query.error ? (
          <p role="status">Health checks unavailable. Try again shortly.</p>
        ) : query.isPending ? (
          <p role="status">Checking services…</p>
        ) : (
          <ul>
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
        {query.data && !query.error && (
          <p className="application-metrics-hint">
            Checked{" "}
            {new Date(query.data.checked_at * 1000).toLocaleTimeString()} ·
            updates every 30 seconds
          </p>
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
