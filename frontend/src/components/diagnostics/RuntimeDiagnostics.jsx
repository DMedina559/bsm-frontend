import { useState, useSyncExternalStore } from "react";
import { Download, Trash2 } from "lucide-react";
import { application } from "../../app/application";
import { runtimeHistory } from "../../app/runtimeHistoryStore";
import { usePreference } from "../../app/usePreference";
import Timestamp from "../Timestamp";
import Modal from "../Modal";
const defaults = { recording: false, persist: false };
export default function RuntimeDiagnostics() {
  const live = useSyncExternalStore(
    application.diagnostics.subscribe,
    application.diagnostics.getSnapshot,
  );
  const history = useSyncExternalStore(
    runtimeHistory.subscribe,
    runtimeHistory.getSnapshot,
  );
  const [options, setOptions] = usePreference("runtimeDiagnostics", defaults);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const matches = history.events
    .filter((event) =>
      Object.entries(filters).every(
        ([key, value]) =>
          !value ||
          (key === "session"
            ? event.session === history.session
              ? "current"
              : "previous"
            : event[key]) === value,
      ),
    )
    .toReversed();
  const lastPage = Math.max(0, Math.ceil(matches.length / 50) - 1);
  const activePage = Math.min(page, lastPage);
  const shown = matches.slice(activePage * 50, activePage * 50 + 50);
  const exportHistory = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(runtimeHistory.export(), null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bsm-frontend-diagnostics.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      className="runtime-diagnostics"
      aria-labelledby="frontend-runtime-title"
    >
      <div className="runtime-diagnostic-heading">
        <div>
          <h2 id="frontend-runtime-title">Frontend runtime</h2>
          <p className="monitor-muted">
            Browser observations, separate from backend diagnostics.
          </p>
        </div>
        <span
          className={`runtime-recording-status ${live.enabled ? "is-recording" : ""}`}
        >
          {live.enabled ? "Recording" : "Paused"}
        </span>
      </div>
      <dl className="application-metric-grid diagnostic-summary">
        <div>
          <dt>Live subscription topics</dt>
          <dd>{live.subscriptions}</dd>
        </div>
        <div>
          <dt>Live references</dt>
          <dd>{live.references}</dd>
        </div>
        <div>
          <dt>Retained observations</dt>
          <dd>{history.events.length} / 1,000</dd>
        </div>
        <div>
          <dt>Previous sessions</dt>
          <dd>
            {
              history.events.filter((row) => row.session !== history.session)
                .length
            }
          </dd>
        </div>
      </dl>
      <div className="runtime-recording-controls settings-panel">
        <label>
          <input
            type="checkbox"
            checked={options.recording}
            onChange={(event) =>
              setOptions({ ...options, recording: event.target.checked })
            }
          />
          Record frontend observations
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.persist}
            onChange={(event) =>
              setOptions({ ...options, persist: event.target.checked })
            }
          />
          Keep history across reloads
        </label>
        <p className="form-help-text">
          Up to 1,000 observations for seven days, isolated by account and
          backend. Pausing keeps history. Disabling persistence removes the
          saved copy. Live counters describe this session only.
        </p>
        <p className="form-help-text">
          Only fixed observation types, policy reasons, resource families, times
          and counts are retained. Request bodies, credentials, identities,
          resource names and payload values are excluded.
        </p>
        {history.persistence === "unavailable" && (
          <p className="message warning" role="status">
            Browser storage is unavailable. History continues in memory; saved
            history may not be updated or removed.
          </p>
        )}
        <div className="diagnostic-actions">
          <button
            className="action-button secondary"
            disabled={!history.events.length}
            onClick={exportHistory}
          >
            <Download size={16} />
            Download JSON
          </button>
          <button
            className="action-button secondary"
            disabled={!history.events.length}
            onClick={() => {
              runtimeHistory.clear();
              setSelected(null);
              setPage(0);
            }}
          >
            <Trash2 size={16} />
            Clear history
          </button>
        </div>
      </div>
      <div className="diagnostic-filters runtime-history-filters">
        {[
          ["type", "Observation"],
          ["reason", "Reason"],
          ["family", "Resource family"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              className="form-input"
              value={filters[key] || ""}
              onChange={(event) => {
                setFilters({ ...filters, [key]: event.target.value });
                setPage(0);
              }}
            >
              <option value="">All</option>
              {[
                ...new Set(
                  history.events.map((event) => event[key]).filter(Boolean),
                ),
              ]
                .sort()
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
        ))}
        <label>
          Session
          <select
            className="form-input"
            value={filters.session || ""}
            onChange={(event) => {
              setFilters({ ...filters, session: event.target.value });
              setPage(0);
            }}
          >
            <option value="">All sessions</option>
            <option value="current">Current session</option>
            <option value="previous">Previous sessions</option>
          </select>
        </label>
      </div>
      <div className="table-container runtime-history-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Observation</th>
              <th>Reason / resource</th>
              <th>Session</th>
              <th>Count</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((event, index) => (
              <tr key={`${event.session}:${event.at}:${index}`}>
                <td>
                  <Timestamp value={event.at} />
                </td>
                <td>{event.type}</td>
                <td>
                  {event.reason ?? "—"}
                  <small>{event.family ?? "—"}</small>
                </td>
                <td>
                  {event.session === history.session
                    ? "Current"
                    : "Previous session"}
                </td>
                <td>{event.count ?? "—"}</td>
                <td>
                  <button
                    className="action-button secondary"
                    onClick={() => setSelected(event)}
                    aria-label={`Inspect ${event.type} observation`}
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!matches.length && (
        <p className="runtime-empty">
          {history.events.length
            ? "No observations match these filters."
            : live.enabled
              ? "Waiting for frontend observations. Navigate the app to record activity."
              : "No observations recorded. Enable recording to capture frontend activity."}
        </p>
      )}
      <div className="runtime-history-pagination">
        <span>
          {matches.length
            ? `${activePage * 50 + 1}–${Math.min((activePage + 1) * 50, matches.length)} of ${matches.length}`
            : "0 observations"}
        </span>
        <button
          className="action-button secondary"
          disabled={!activePage}
          onClick={() => setPage(activePage - 1)}
        >
          Previous
        </button>
        <button
          className="action-button secondary"
          disabled={activePage >= lastPage}
          onClick={() => setPage(activePage + 1)}
        >
          Next
        </button>
      </div>
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Frontend observation"
        className="runtime-observation-modal"
      >
        {selected && (
          <dl className="diagnostic-values">
            <div>
              <dt>Time</dt>
              <dd>
                <Timestamp value={selected.at} />
              </dd>
            </div>
            {Object.entries(selected)
              .filter(([key]) => !["at", "session"].includes(key))
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            <div>
              <dt>Session</dt>
              <dd>
                {selected.session === history.session
                  ? "Current session"
                  : "Previous session"}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </section>
  );
}
