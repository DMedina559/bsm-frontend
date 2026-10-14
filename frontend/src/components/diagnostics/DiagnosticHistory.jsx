import { useState } from "react";
import { useResourceQuery } from "../../app/resourceQueries";
import QueryStatus from "../QueryStatus";
import DiagnosticDetails from "./DiagnosticDetails";
import { dateValue } from "./format";

export default function DiagnosticHistory({
  onTrace,
  instance,
  active = true,
}) {
  const [filters, setFilters] = useState({});
  const [draft, setDraft] = useState({});
  const [cursors, setCursors] = useState([null]);
  const query = useResourceQuery(
    "diagnosticHistory",
    { ...filters, limit: 50, cursor: cursors.at(-1) },
    { retry: false, enabled: active },
  );
  const runs = useResourceQuery("diagnosticRuns", undefined, {
    retry: false,
    enabled: active,
  });
  return (
    <section
      className="diagnostic-history"
      aria-labelledby="diagnostic-history-heading"
    >
      <h2 id="diagnostic-history-heading">History across restarts</h2>
      <p>
        Sanitized retained records. Live counters reset with each application
        instance; missing closing records do not prove a crash.
      </p>
      <form
        className="diagnostic-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(
            Object.fromEntries(Object.entries(draft).filter(([, v]) => v)),
          );
          setCursors([null]);
        }}
      >
        <label>
          Subsystem
          <input
            maxLength={80}
            value={draft.subsystem ?? ""}
            onChange={(e) => setDraft({ ...draft, subsystem: e.target.value })}
            placeholder="All subsystems"
          />
        </label>
        <label>
          Outcome
          <select
            value={draft.outcome ?? ""}
            onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
          >
            <option value="">All outcomes</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Correlation ID
          <input
            maxLength={160}
            value={draft.correlation_id ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, correlation_id: e.target.value })
            }
          />
        </label>
        {[
          ["owner", "Owner", 160],
          ["code", "Code", 80],
          ["operation_id", "Operation ID", 160],
        ].map(([key, label, maximum]) => (
          <label key={key}>
            {label}
            <input
              maxLength={maximum}
              value={draft[key] ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <label>
          Instance
          <select
            value={draft.instance_id ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, instance_id: e.target.value })
            }
          >
            <option value="">All retained instances</option>
            {runs.data?.runs.map((run) => (
              <option key={run.instance_id} value={run.instance_id}>
                {run.instance_id === instance ? "Current" : "Previous"} ·{" "}
                {run.instance_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <button className="action-button secondary" type="submit">
          Apply filters
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Refresh history
        </button>
      </form>
      <QueryStatus query={query} />
      {query.isPending && <p role="status">Loading history…</p>}
      {query.data?.available === false && (
        <p role="status">
          Retained history is unavailable. Live observations may still be
          available.
        </p>
      )}
      {query.data?.available && (
        <div className="table-responsive-wrapper">
          <table className="server-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Subsystem</th>
                <th>Operation</th>
                <th>Outcome</th>
                <th>Correlation</th>
              </tr>
            </thead>
            <tbody>
              {query.data.records.map((record) => (
                <tr key={record.id}>
                  <td>{dateValue(record.timestamp)}</td>
                  <td>{record.subsystem}</td>
                  <td>
                    <details>
                      <summary>{record.operation}</summary>
                      <DiagnosticDetails value={record} />
                    </details>
                  </td>
                  <td>{record.outcome}</td>
                  <td>
                    {record.correlation_id ? (
                      <button
                        type="button"
                        className="action-button secondary"
                        onClick={() => onTrace(record.correlation_id)}
                      >
                        Inspect trace
                      </button>
                    ) : (
                      "No correlation ID"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!query.data.records.length && <p>No matching retained records.</p>}
        </div>
      )}
      <div className="diagnostic-actions">
        <button
          type="button"
          disabled={cursors.length === 1 || query.isFetching}
          onClick={() => setCursors(cursors.slice(0, -1))}
        >
          Previous page
        </button>
        <button
          type="button"
          disabled={!query.data?.next_cursor || query.isFetching}
          onClick={() => setCursors([...cursors, query.data.next_cursor])}
        >
          Next page
        </button>
      </div>
      <details>
        <summary>Retained application instances</summary>
        <QueryStatus query={runs} />
        {runs.data?.available === false ? (
          <p>Instance summaries unavailable.</p>
        ) : (
          <DiagnosticDetails value={runs.data?.runs} />
        )}
      </details>
    </section>
  );
}
