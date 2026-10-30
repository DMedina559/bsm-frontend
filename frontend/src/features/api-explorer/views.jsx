import React, { useId, useState } from "react";
import { ChevronRight, Copy, Check, Braces, Search } from "lucide-react";
import { resolve, pretty, schemaType, objectFields } from "./schema";

export function Method({ method }) {
  return (
    <span className={`ae-method ae-method-${method.toLowerCase()}`}>
      {method}
    </span>
  );
}
export function CopyButton({ value, label = "Copy JSON" }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="ae-button ae-icon-button"
        aria-label={label}
        title={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setError("");
          } catch {
            setError("Copy unavailable");
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copied" : "Copy"}
      </button>
      {error && <small role="status">{error}</small>}
    </>
  );
}
export function CodeView({ value }) {
  const text = pretty(value);
  return (
    <div className="ae-code">
      <div className="ae-code-tools">
        <span>JSON</span>
        <CopyButton value={text} />
      </div>
      <pre>
        {text.length > 60000
          ? `${text.slice(0, 60000)}\n… Preview limited to 60,000 characters. Copy for the complete JSON.`
          : text}
      </pre>
    </div>
  );
}
function TypeLabel({ schema, value, onModel }) {
  if (value?.$ref)
    return (
      <button
        className="ae-link"
        type="button"
        onClick={() => onModel?.(schemaType(schema, value))}
      >
        {schemaType(schema, value)}
      </button>
    );
  const spec = resolve(schema, value);
  const alternatives = spec.anyOf ?? spec.oneOf;
  if (alternatives)
    return (
      <span className="ae-type">
        {alternatives.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 && " | "}
            <TypeLabel schema={schema} value={part} onModel={onModel} />
          </React.Fragment>
        ))}
      </span>
    );
  if (spec.type === "array")
    return (
      <span className="ae-type">
        <TypeLabel schema={schema} value={spec.items} onModel={onModel} />
        []
      </span>
    );
  return <span className="ae-type">{schemaType(schema, value)}</span>;
}
export function SchemaView({ schema, value, onModel, depth = 0 }) {
  if (depth > 3)
    return <span className="ae-type">{schemaType(schema, value)}</span>;
  const spec = objectFields(schema, value);
  const properties = Object.entries(spec.properties ?? {});
  return (
    <div className="ae-schema-view">
      {spec.description && <p className="ae-description">{spec.description}</p>}
      {value?.$ref && (
        <div className="ae-schema-name">
          <Braces size={15} />
          <button
            type="button"
            className="ae-link"
            onClick={() => onModel?.(schemaType(schema, value))}
          >
            {schemaType(schema, value)}
          </button>
        </div>
      )}
      {properties.length ? (
        <div
          className="ae-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable data table"
        >
          <table className="ae-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {properties.map(([name, raw]) => {
                const field = resolve(schema, raw);
                return (
                  <tr key={name}>
                    <td>
                      <code>{name}</code>
                      {spec.required?.includes(name) && (
                        <span className="ae-required">required</span>
                      )}
                    </td>
                    <td>
                      <TypeLabel
                        schema={schema}
                        value={raw}
                        onModel={onModel}
                      />
                    </td>
                    <td>
                      {field.description || <span className="ae-muted">—</span>}
                      {field.enum && (
                        <div className="ae-enum">
                          {field.enum.map((v) => (
                            <code key={pretty(v)}>{String(v)}</code>
                          ))}
                        </div>
                      )}
                      {field.default !== undefined && (
                        <small className="ae-hint">
                          Default: {pretty(field.default)}
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ae-schema-summary">
          <span className="ae-type">{schemaType(schema, value)}</span>
          {spec.enum && (
            <div className="ae-enum">
              {spec.enum.map((v) => (
                <code key={pretty(v)}>{String(v)}</code>
              ))}
            </div>
          )}
          {(spec.anyOf ?? spec.oneOf ?? []).map((part, i) => (
            <div key={i} className="ae-schema-alternative">
              <SchemaView
                schema={schema}
                value={part}
                onModel={onModel}
                depth={depth + 1}
              />
            </div>
          ))}
          {spec.type === "array" && (
            <SchemaView
              schema={schema}
              value={spec.items}
              onModel={onModel}
              depth={depth + 1}
            />
          )}
        </div>
      )}
    </div>
  );
}
export function SchemaField({
  schema,
  spec: raw,
  name,
  required,
  value,
  onChange,
  location,
  disabled,
  depth = 0,
}) {
  const id = useId();
  let spec = resolve(schema, raw);
  const alternatives = spec.anyOf ?? spec.oneOf;
  if (alternatives?.length === 2 && alternatives.some((s) => s.type === "null"))
    spec = resolve(
      schema,
      alternatives.find((s) => s.type !== "null"),
    );
  const type = schemaType(schema, spec);
  const properties = Object.entries(spec.properties ?? {}).filter(
    ([, field]) => !field.readOnly,
  );
  const change = (text) => {
    if (text === "") return onChange(undefined);
    if (spec.type === "string") return onChange(text);
    try {
      onChange(JSON.parse(text));
    } catch {
      onChange(text);
    }
  };
  if (properties.length && depth < 3)
    return (
      <fieldset className="ae-object-field">
        <legend>
          {name}
          {required && <span className="ae-required">required</span>}
        </legend>
        {properties.map(([key, child]) => (
          <SchemaField
            key={key}
            schema={schema}
            spec={child}
            name={key}
            required={spec.required?.includes(key)}
            value={value?.[key]}
            disabled={disabled}
            depth={depth + 1}
            onChange={(next) => {
              const updated = {
                ...(value && typeof value === "object" ? value : {}),
              };
              if (next === undefined) delete updated[key];
              else updated[key] = next;
              onChange(updated);
            }}
          />
        ))}
      </fieldset>
    );
  const choices = spec.enum ?? (spec.type === "boolean" ? [true, false] : null);
  const stringValue =
    value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : pretty(value);
  const complex =
    !choices &&
    (spec.type === "array" ||
      spec.type === "object" ||
      spec.anyOf ||
      spec.oneOf ||
      !spec.type);
  return (
    <div className="ae-field">
      <label htmlFor={id}>
        <span>
          {name}
          {location && <small className="ae-location"> ({location})</small>}
        </span>
        <span className="ae-field-meta">
          <span className="ae-type">{type}</span>
          {required && <span className="ae-required">required</span>}
        </span>
      </label>
      {choices ? (
        <select
          id={id}
          disabled={disabled}
          value={stringValue}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">{required ? "Select a value" : "Not set"}</option>
          {choices.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v)}
            </option>
          ))}
        </select>
      ) : complex ? (
        <textarea
          id={id}
          rows={3}
          disabled={disabled}
          placeholder={
            spec.default !== undefined
              ? `Default: ${pretty(spec.default)}`
              : `Enter ${type}`
          }
          value={stringValue}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <input
          id={id}
          type={spec.format === "password" ? "password" : "text"}
          inputMode={
            ["integer", "number"].includes(spec.type) ? "decimal" : undefined
          }
          disabled={disabled}
          placeholder={
            spec.default !== undefined
              ? `Default: ${pretty(spec.default)}`
              : required
                ? "Required"
                : "Optional"
          }
          value={stringValue}
          onChange={(e) => change(e.target.value)}
        />
      )}
      {spec.description && (
        <small className="ae-hint">{spec.description}</small>
      )}
    </div>
  );
}
function Scalar({ value }) {
  return (
    <span
      className={`ae-scalar ae-scalar-${value === null ? "null" : typeof value}`}
    >
      {value === null
        ? "null"
        : value === undefined
          ? "—"
          : String(value).length > 1500
            ? `${String(value).slice(0, 1500)}… (truncated; full value in JSON)`
            : String(value)}
    </span>
  );
}
export function DataView({ value, depth = 0 }) {
  if (value === null || typeof value !== "object")
    return <Scalar value={value} />;
  if (depth > 4) return <CodeView value={value} />;
  if (Array.isArray(value)) return <ArrayView value={value} depth={depth} />;
  const entries = Object.entries(value);
  if (!entries.length) return <p className="ae-muted">Empty object</p>;
  return (
    <dl className="ae-properties">
      {entries.slice(0, 100).map(([key, item]) => (
        <div
          key={key}
          className={Array.isArray(item) ? "ae-property-collection" : undefined}
        >
          <dt>{key}</dt>
          <dd>
            {item !== null && typeof item === "object" ? (
              <NestedData
                value={item}
                depth={depth + 1}
                expanded={depth === 0 && Array.isArray(item)}
              />
            ) : (
              <Scalar value={item} />
            )}
          </dd>
        </div>
      ))}
      {entries.length > 100 && (
        <p className="ae-muted">
          Showing the first 100 properties. Full output is available in JSON.
        </p>
      )}
    </dl>
  );
}
function NestedData({ value, depth, expanded = false, label }) {
  const [open, setOpen] = useState(expanded);
  return (
    <details
      className="ae-nested"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <ChevronRight size={14} />
        {label ??
          (Array.isArray(value)
            ? `${value.length} items`
            : `${Object.keys(value).length} properties`)}
      </summary>
      {open && <DataView value={value} depth={depth} />}
    </details>
  );
}
function ArrayView({ value, depth }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = query
    ? value.filter((item) =>
        pretty(item).toLowerCase().includes(query.toLowerCase()),
      )
    : value;
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * 25, current * 25 + 25);
  const tabular =
    rows.length > 0 &&
    rows.every(
      (item) =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    );
  const columns = tabular
    ? [...new Set(rows.flatMap((item) => Object.keys(item)))].slice(0, 8)
    : [];
  return (
    <div className="ae-array">
      {(depth === 0 || value.length > 10) && (
        <div className="ae-array-toolbar">
          <span className="ae-muted">
            {filtered.length}
            {query ? ` of ${value.length}` : ""} items
          </span>
          {value.length > 10 && (
            <label className="ae-search">
              <Search size={14} />
              <input
                aria-label="Filter response items"
                placeholder="Filter items…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          )}
        </div>
      )}
      {!rows.length ? (
        <p className="ae-muted">
          {value.length ? "No matching items." : "No items returned."}
        </p>
      ) : tabular ? (
        <div
          className="ae-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable data table"
        >
          <table className="ae-table">
            <thead>
              <tr>
                {columns.map((key) => (
                  <th key={key}>{key}</th>
                ))}
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((key) => (
                    <td key={key}>
                      {row[key] !== null && typeof row[key] === "object" ? (
                        <span className="ae-type">
                          {Array.isArray(row[key])
                            ? `${row[key].length} items`
                            : "object"}
                        </span>
                      ) : (
                        <Scalar value={row[key]} />
                      )}
                    </td>
                  ))}
                  <td>
                    <NestedData value={row} depth={depth + 1} label="Inspect" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="ae-value-list">
          {rows.map((item, index) => (
            <li key={index}>
              <span className="ae-row-index">{current * 25 + index + 1}</span>
              <DataView value={item} depth={depth + 1} />
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="ae-pagination">
          <span>
            {current * 25 + 1}–{Math.min((current + 1) * 25, filtered.length)}{" "}
            of {filtered.length}
          </span>
          <div>
            <button
              className="ae-button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <button
              className="ae-button"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
