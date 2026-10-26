import { useState } from "react";
import { useResourceQuery } from "../../app/resourceQueries";
import QueryStatus from "../QueryStatus";
import DiagnosticDetails from "./DiagnosticDetails";

function ActivityRecords({ title, records = [], onTrace }) {
  return (
    <section className="diagnostic-card" aria-label={title}>
      <h3>{title}</h3>
      {!records.length && <p>No matching entries.</p>}
      {records.map((record, index) => (
        <details key={record.event_id ?? record.operation_id ?? index}>
          <summary>
            {record.name} · {record.server_name ?? "Application"} ·{" "}
            {record.status}
          </summary>
          {record.correlation_id && (
            <button
              className="action-button secondary"
              type="button"
              onClick={() => onTrace(record.correlation_id)}
            >
              Inspect trace
            </button>
          )}
          <DiagnosticDetails value={record} />
        </details>
      ))}
    </section>
  );
}
export default function DiagnosticActivity({ onTrace, automatic = false }) {
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({});
  const query = useResourceQuery(
    "diagnosticActivity",
    { ...filters, limit: 100 },
    {
      retry: false,
      refetchInterval: automatic ? 15000 : false,
      refetchIntervalInBackground: false,
    },
  );
  const data = query.data;
  return (
    <section aria-label="Global event and operation activity">
      <h2>Activity across all execution chains</h2>
      <p>
        Active and recent metadata from this application instance. History is
        bounded and resets on restart. Event payloads and task arguments are
        excluded.
      </p>
      <form
        className="diagnostic-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters(
            Object.fromEntries(
              Object.entries(draft)
                .map(([key, value]) => [key, value.trim()])
                .filter(([, value]) => value),
            ),
          );
        }}
      >
        {[
          ["server_name", "Server"],
          ["name", "Event name"],
          ["operation_name", "Operation name"],
          ["owner", "Owner"],
          ["sequence_id", "Sequence ID"],
          ["correlation_id", "Correlation ID"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              className="form-input"
              maxLength={160}
              value={draft[key] ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <button className="action-button secondary" type="submit">
          Apply filters
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setDraft({});
            setFilters({});
          }}
        >
          Clear filters
        </button>
      </form>
      <button
        className="action-button secondary"
        type="button"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        Refresh activity
      </button>
      <QueryStatus query={query} />
      {query.error && (
        <p>
          Activity could not be loaded. Older backends may not provide global
          activity. Other diagnostic views remain available.
        </p>
      )}
      {query.isPending && !query.error && (
        <p role="status">Loading activity…</p>
      )}
      {data && (
        <>
          {data.issues?.map((issue) => (
            <p key={issue.code}>{issue.message}</p>
          ))}
          {data.truncated && (
            <p role="status">
              This view is partial. Narrow the filters to inspect more specific
              activity.
            </p>
          )}
          {data.events === null ? (
            <p>Event observations are unavailable.</p>
          ) : (
            <>
              <ActivityRecords
                title="Active events"
                records={data.events.active}
                onTrace={onTrace}
              />
              <ActivityRecords
                title="Recent events"
                records={data.events.recent}
                onTrace={onTrace}
              />
            </>
          )}
          {data.operations === null ? (
            <p>Operation observations are unavailable.</p>
          ) : (
            <>
              <ActivityRecords
                title="Active operations"
                records={data.operations.active}
                onTrace={onTrace}
              />
              <ActivityRecords
                title="Recent operation outcomes"
                records={data.operations.recent}
                onTrace={onTrace}
              />
            </>
          )}
          <section className="diagnostic-card" aria-label="Event listeners">
            <h3>Event listeners</h3>
            <p>
              Listener configuration follows event-name and owner filters;
              execution-chain filters apply to activity records.
            </p>
            {data.subscriptions === null ? (
              <p>Listener observations are unavailable.</p>
            ) : (
              <>
                <p>
                  {data.subscriptions.total} registered listeners
                  {data.subscriptions.truncated ? " · partial view" : ""}
                </p>
                <DiagnosticDetails value={data.subscriptions.items} />
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
