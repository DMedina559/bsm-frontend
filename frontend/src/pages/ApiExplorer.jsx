import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  createExplorerClient,
  executeExplorerOperation,
  loadExplorerSchema,
} from "../api/explorer";
import { sessionSettings } from "../app/browserStorage";
import {
  inspectSchema,
  exampleValue,
  inputValue,
  prepareCall,
  resolve,
} from "../features/api-explorer/schema";
import "../styles/api-explorer.css";

const json = (value) => JSON.stringify(value, null, 2);
function Explorer() {
  const [schema, setSchema] = useState(null);
  const [source, setSource] = useState("");
  const [operations, setOperations] = useState(
    /** @type {ReturnType<typeof inspectSchema>} */ ([]),
  );
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [values, setValues] = useState({});
  const [body, setBody] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const operation = operations.find((item) => item.id === selected);
  const matches = operations.filter((item) =>
    `${item.id} ${item.path} ${item.method} ${item.definition.tags?.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const client = useMemo(
    () => (schema ? createExplorerClient(schema) : null),
    [schema],
  );
  function load(value) {
    const next = inspectSchema(value);
    setSchema(value);
    setOperations(next);
    setSelected("");
    setModel("");
    setResult(null);
    setError("");
  }
  async function live() {
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      load(await loadExplorerSchema(abort.signal));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function choose(id) {
    setSelected(id);
    setValues({});
    setBody("");
    setResult(null);
    setError("");
  }
  let preview;
  try {
    if (operation && client) {
      const options = prepareCall(schema, operation, values, body);
      preview = {
        method: operation.method,
        url: client.resolveOperationUrl(operation.id, options),
        ...options,
      };
    }
  } catch (e) {
    preview = { validation: e.message };
  }
  async function execute(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const options = prepareCall(schema, operation, values, body);
      setBusy(true);
      const response = await executeExplorerOperation(schema, operation.id, {
        ...options,
        signal: abort.signal,
      });
      if (response.error) setError(response.error);
      setResult({
        ...response,
        data:
          response.data instanceof Blob
            ? {
                binary: true,
                bytes: response.data.size,
                type: response.data.type,
              }
            : response.data,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const bodySchema = operation?.request.content?.["application/json"]?.schema;
  const fields = bodySchema ? resolve(schema, bodySchema) : {};
  let bodyObject;
  try {
    bodyObject = body.trim() ? JSON.parse(body) : {};
  } catch {
    bodyObject = null;
  }
  return (
    <div className="api-explorer">
      <header>
        <h1>API Explorer</h1>
        <p>Inspect and call the connected backend’s core and plugin APIs.</p>
      </header>
      <section className="card">
        <h2>OpenAPI contract</h2>
        <p>
          Requests use your current BSM connection and session. Imported server
          URLs are ignored. Calls perform real actions.
        </p>
        <button className="action-button" disabled={busy} onClick={live}>
          Load connected backend
        </button>
        <label>
          Upload OpenAPI JSON
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (event) => {
              try {
                const file = event.target.files[0];
                if (file) load(JSON.parse(await file.text()));
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        </label>
        <details>
          <summary>Paste OpenAPI JSON</summary>
          <textarea
            aria-label="OpenAPI JSON"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <button
            disabled={busy}
            onClick={() => {
              try {
                load(JSON.parse(source));
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Load JSON
          </button>
        </details>
        {schema && (
          <p>
            {schema.info?.title} · {schema.info?.version} · OpenAPI{" "}
            {schema.openapi} · {operations.length} operations
          </p>
        )}
      </section>
      {error && (
        <div role="alert" className="card">
          {error}
        </div>
      )}
      {schema && (
        <div className="api-explorer-grid">
          <section className="card">
            <h2>Operations</h2>
            <input
              aria-label="Search operations"
              placeholder="Search ID, path, method, or tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="api-operation-list">
              {matches.map((item) => (
                <button
                  disabled={busy}
                  aria-pressed={selected === item.id}
                  key={item.id}
                  onClick={() => choose(item.id)}
                >
                  <strong>
                    {item.method} {item.id}
                  </strong>
                  <small>{item.path}</small>
                </button>
              ))}
            </div>
            {!matches.length && <p>No matching operations.</p>}
          </section>
          <section className="card">
            <h2>{operation?.id ?? "Select an operation"}</h2>
            {operation && (
              <>
                <p>{operation.definition.summary}</p>
                <p>{operation.definition.description}</p>
                <form onSubmit={execute}>
                  {operation.parameters.map((parameter) => {
                    const key = `${parameter.in}:${parameter.name}`;
                    const spec = resolve(schema, parameter.schema);
                    return (
                      <label key={key}>
                        {parameter.name} ({parameter.in})
                        {parameter.required ? " *" : ""}
                        <small>{parameter.description}</small>
                        {spec.enum ? (
                          <select
                            value={values[key] ?? ""}
                            onChange={(e) =>
                              setValues({ ...values, [key]: e.target.value })
                            }
                          >
                            <option value="">Choose…</option>
                            {spec.enum.map((v) => (
                              <option key={String(v)} value={String(v)}>
                                {String(v)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            placeholder={
                              spec.default !== undefined
                                ? `Default: ${json(spec.default)}`
                                : (spec.type ?? "JSON")
                            }
                            value={values[key] ?? ""}
                            onChange={(e) =>
                              setValues({ ...values, [key]: e.target.value })
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                  {bodySchema && (
                    <>
                      <h3>Request body</h3>
                      <button
                        type="button"
                        onClick={() =>
                          setBody(json(exampleValue(schema, bodySchema)))
                        }
                      >
                        Fill example
                      </button>
                      <details>
                        <summary>Schema fields</summary>
                        {Object.entries(fields.properties ?? {}).map(
                          ([name, raw]) => {
                            const spec = resolve(schema, raw);
                            return (
                              <label key={name}>
                                {name}
                                {fields.required?.includes(name) ? " *" : ""}
                                <small>{spec.description}</small>
                                <input
                                  disabled={
                                    !bodyObject ||
                                    typeof bodyObject !== "object" ||
                                    Array.isArray(bodyObject)
                                  }
                                  placeholder={spec.type ?? "JSON"}
                                  value={
                                    bodyObject?.[name] === undefined
                                      ? ""
                                      : typeof bodyObject[name] === "string"
                                        ? bodyObject[name]
                                        : json(bodyObject[name])
                                  }
                                  onChange={(e) => {
                                    try {
                                      const next = { ...bodyObject };
                                      if (e.target.value === "")
                                        delete next[name];
                                      else
                                        next[name] = inputValue(
                                          schema,
                                          spec,
                                          e.target.value,
                                        );
                                      setBody(json(next));
                                      setError("");
                                    } catch {
                                      setError(
                                        `Enter valid ${spec.type ?? "JSON"} for ${name}; use the JSON editor for nested values.`,
                                      );
                                    }
                                  }}
                                />
                              </label>
                            );
                          },
                        )}
                      </details>
                      <label>
                        JSON body
                        <textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          placeholder="Enter request JSON"
                        />
                      </label>
                    </>
                  )}
                  {!bodySchema && operation.request.required && (
                    <p>
                      This request requires{" "}
                      {Object.keys(operation.request.content ?? {}).join(", ")}.
                      Execution currently supports JSON bodies only.
                    </p>
                  )}
                  <details open>
                    <summary>Request preview</summary>
                    <pre>{json(preview)}</pre>
                  </details>
                  <button
                    className="action-button primary"
                    disabled={busy || !preview || !!preview.validation}
                    type="submit"
                  >
                    Execute {operation.method}
                  </button>
                </form>
                <details>
                  <summary>Request and response contract</summary>
                  <pre>{json(operation.definition)}</pre>
                </details>
              </>
            )}
          </section>
        </div>
      )}
      {busy && (
        <div role="status">
          Request running…{" "}
          <button onClick={() => controller.current?.abort()}>Cancel</button>
        </div>
      )}
      {result && (
        <section className="card">
          <h2>Response</h2>
          <pre>{json(result)}</pre>
        </section>
      )}
      {schema && (
        <section className="card">
          <h2>Models</h2>
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="">Select a model</option>
              {Object.keys(schema.components?.schemas ?? {})
                .sort()
                .map((name) => (
                  <option key={name}>{name}</option>
                ))}
            </select>
          </label>
          {model && (
            <>
              <pre>{json(schema.components.schemas[model])}</pre>
              <p>Referenced models</p>
              {[
                ...new Set(
                  json(schema.components.schemas[model]).match(
                    /#\/components\/schemas\/[^"\s]+/g,
                  ) ?? [],
                ),
              ].map((ref) => (
                <button
                  key={ref}
                  onClick={() =>
                    setModel(
                      ref
                        .split("/")
                        .at(-1)
                        .replace(/~1/g, "/")
                        .replace(/~0/g, "~"),
                    )
                  }
                >
                  {ref.split("/").at(-1)}
                </button>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
export default function ApiExplorer() {
  const location = useLocation();
  const flag = new URLSearchParams(location.search).get("hidden");
  const enabled =
    flag === "true" ||
    (flag !== "false" &&
      sessionSettings.getItem("show_hidden_flag") === "true");
  return enabled ? <Explorer /> : <Navigate to="/" replace />;
}
