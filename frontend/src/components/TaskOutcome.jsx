import "../styles/task-outcome.css";

function OutcomeValue({ value }) {
  if (value === null) return <span className="task-value-empty">None</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="task-value-list">
        {value.map((item, index) => (
          <li key={index}>
            <OutcomeValue value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span>No items</span>
    );
  if (typeof value === "object")
    return (
      <dl className="task-value-fields">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{key.replace(/_/g, " ")}</dt>
            <dd>
              <OutcomeValue value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span>
      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
    </span>
  );
}
export default function TaskOutcome({
  result,
  error,
  rawLabel = "View task outcome",
}) {
  const hasResult = result !== null && result !== undefined;
  if (!hasResult && !error) return null;
  return (
    <div className="task-outcome">
      {error && (
        <div className="task-outcome-error">
          <strong>
            {error.message ??
              (typeof error === "string" ? error : "Operation failed")}
          </strong>
          {error.code && <p>Error: {error.code}</p>}
          {error.details != null && <OutcomeValue value={error.details} />}
        </div>
      )}
      {hasResult && <OutcomeValue value={result} />}
      <details className="task-outcome-raw">
        <summary>{rawLabel}</summary>
        <pre>{JSON.stringify(error ? { error, result } : result, null, 2)}</pre>
      </details>
    </div>
  );
}
