import { labelFor, displayValue, dateValue } from "./format";

export default function DiagnosticDetails({
  value,
  name = "Observations",
  depth = 0,
}) {
  if (value === null || value === undefined)
    return <p>Observations unavailable.</p>;
  if (Array.isArray(value)) {
    if (!value.length) return <p>No entries.</p>;
    return (
      <div className="diagnostic-entries">
        {value.map((entry, index) =>
          typeof entry === "object" && entry !== null ? (
            <details key={index}>
              <summary>
                {entry.name ??
                  entry.server_name ??
                  entry.operation ??
                  entry.id ??
                  entry.event_id ??
                  entry.subsystem ??
                  `Entry ${index + 1}`}
              </summary>
              <DiagnosticDetails value={entry} depth={depth + 1} />
            </details>
          ) : (
            <p key={index}>{displayValue(entry)}</p>
          ),
        )}
      </div>
    );
  }
  if (typeof value !== "object") return <p>{displayValue(value)}</p>;
  const scalars = Object.entries(value).filter(
    ([key, item]) =>
      key !== "kind" && (item === null || typeof item !== "object"),
  );
  const nested = Object.entries(value).filter(
    ([, item]) => item !== null && typeof item === "object",
  );
  return (
    <div className="diagnostic-details">
      {!!scalars.length && (
        <dl className="diagnostic-values" aria-label={name}>
          {scalars.map(([key, item]) => (
            <div key={key}>
              <dt>{labelFor(key)}</dt>
              <dd>
                {key.endsWith("_at") || key === "timestamp"
                  ? dateValue(item)
                  : displayValue(item)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {nested.map(([key, item]) => (
        <details key={key}>
          <summary>
            {labelFor(key)}
            {Array.isArray(item) ? ` (${item.length})` : ""}
          </summary>
          {depth < 8 ? (
            <DiagnosticDetails
              value={item}
              name={labelFor(key)}
              depth={depth + 1}
            />
          ) : (
            <p>Further nested details are available in the support report.</p>
          )}
        </details>
      ))}
    </div>
  );
}
