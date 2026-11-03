import { useEffect } from "react";
import Timestamp from "../Timestamp";
import { useResourceQuery } from "../../app/resourceQueries";
import { useWebSocket } from "../../contexts/WebSocketContext";

const labels = {
  lifecycle: "Application runtime",
  database: "Database",
  state: "Application state",
  metrics: "Metrics collector",
  scheduler: "Scheduler",
  process_manager: "Process manager",
  timezone_data: "Timezone database",
};
export default function ApplicationHealth() {
  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    optional: true,
  });
  const query = useResourceQuery("applicationHealth", undefined, {
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!isConnected) {
      void refetch();
      return;
    }
    subscribe("health");
    void refetch();
    return () => unsubscribe("health");
  }, [isConnected, subscribe, unsubscribe, refetch]);
  const label = query.error
    ? "Unavailable"
    : query.isPending
      ? "Checking"
      : query.data?.health === "healthy"
        ? "Healthy"
        : query.data?.health === "unhealthy"
          ? "Unhealthy"
          : "Degraded";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const cleanTitle = document.title.replace(
      /^(🚨\s*\[Unhealthy\]\s*|⚠️\s*\[Degraded\]\s*)/,
      "",
    );
    if (label === "Degraded") {
      document.title = `⚠️ [Degraded] ${cleanTitle}`;
    } else if (label === "Unhealthy") {
      document.title = `🚨 [Unhealthy] ${cleanTitle}`;
    } else {
      document.title = cleanTitle;
    }
  }, [label]);
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
                  className={
                    check.healthy
                      ? "check-healthy"
                      : query.data?.health === "unhealthy"
                        ? "check-unhealthy"
                        : "check-degraded"
                  }
                >
                  {check.healthy
                    ? "Healthy"
                    : query.data?.health === "unhealthy"
                      ? "Unhealthy"
                      : "Degraded"}
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
