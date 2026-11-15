import { useAccess } from "../app/useAccess";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getPreferenceIdentity } from "../app/backendIdentity";
import ApplicationMetrics from "../components/metrics/ApplicationMetrics";
import ApplicationDiagnostics from "../components/diagnostics/ApplicationDiagnostics";
import "../styles/application-monitor.css";

export default function ApplicationMonitor() {
  const { user, sessionGeneration } = useAuth() || {};
  const [params, setParams] = useSearchParams();
  const selected =
    params.get("view") === "diagnostics" ? "diagnostics" : "metrics";
  const setSelected = (value) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", value);
      return next;
    });
  const { can } = useAccess();
  const diagnostics = can("get_application_diagnostics");
  const active = diagnostics ? selected : "metrics";
  const tabs = ["metrics", "diagnostics"];
  return (
    <div className="container application-monitor">
      <header className="monitor-page-heading">
        <h1>Application Monitor</h1>
        <p>
          {diagnostics
            ? "Application health, metrics and diagnostics."
            : "Application and server process metrics."}
        </p>
      </header>
      {diagnostics && (
        <div className="monitor-tabs" role="tablist" aria-label="Metrics views">
          {tabs.map((tab, index) => (
            <button
              type="button"
              key={tab}
              role="tab"
              id={`monitor-${tab}-tab`}
              aria-controls={`monitor-${tab}-panel`}
              aria-selected={active === tab}
              tabIndex={active === tab ? 0 : -1}
              onClick={() => setSelected(tab)}
              onKeyDown={(event) => {
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 1
                      : event.key === "ArrowRight"
                        ? (index + 1) % 2
                        : event.key === "ArrowLeft"
                          ? (index + 1) % 2
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setSelected(tabs[next]);
                  event.currentTarget.parentElement
                    .querySelectorAll('[role="tab"]')
                    [next].focus();
                }
              }}
            >
              {tab === "metrics" ? "Metrics" : "Diagnostics"}
            </button>
          ))}
        </div>
      )}
      <section
        id={`monitor-${active}-panel`}
        role={diagnostics ? "tabpanel" : undefined}
        aria-labelledby={diagnostics ? `monitor-${active}-tab` : undefined}
      >
        {active === "diagnostics" ? (
          <ApplicationDiagnostics
            key={`${getPreferenceIdentity(user)}:${sessionGeneration ?? 0}`}
          />
        ) : (
          <ApplicationMetrics
            key={`${getPreferenceIdentity(user)}:${sessionGeneration ?? 0}`}
          />
        )}
      </section>
    </div>
  );
}
