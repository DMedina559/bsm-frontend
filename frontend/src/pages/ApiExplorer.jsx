import { useAuth } from "../contexts/AuthContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  Braces,
  Upload,
  RefreshCw,
  Play,
  Square,
  Search,
  ArrowRight,
  FileJson,
  Network,
} from "lucide-react";
import {
  createExplorerClient,
  executeExplorerOperation,
  loadExplorerSchema,
} from "../api/explorer";
import { sessionSettings } from "../app/browserStorage";
import {
  inspectSchema,
  exampleValue,
  prepareCall,
  resolve,
  objectFields,
  pretty,
} from "../features/api-explorer/schema";
import {
  Method,
  CodeView,
  SchemaView,
  SchemaField,
  DataView,
  CopyButton,
} from "../features/api-explorer/views";
import "../styles/api-explorer.css";

function Explorer() {
  const { user } = useAuth();
  const [schema, setSchema] = useState(null);
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [operations, setOperations] = useState(
    /** @type {ReturnType<typeof inspectSchema>} */ ([]),
  );
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [view, setView] = useState("operations");
  const [tab, setTab] = useState("request");
  const [bodyMode, setBodyMode] = useState("fields");
  const [responseMode, setResponseMode] = useState("body");
  const [values, setValues] = useState({});
  const [body, setBody] = useState("");
  const [model, setModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  const reloadSchema = useRef(null);
  useEffect(() => {
    const changed = () => {
      controller.current?.abort();
      void reloadSchema.current?.();
    };
    window.addEventListener("bsm:access-changed", changed);
    return () => window.removeEventListener("bsm:access-changed", changed);
  }, []);
  const fileInput = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const operation = operations.find((item) => item.id === selected);
  const matches = operations.filter(
    (item) =>
      (!tag || item.definition.tags?.includes(tag)) &&
      `${item.id} ${item.path} ${item.method} ${item.definition.summary} ${item.definition.tags?.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const groups = new Map();
  for (const item of matches) {
    const name = item.definition.tags?.[0] ?? "Other";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }
  const client = useMemo(
    () => (schema ? createExplorerClient(schema) : null),
    [schema],
  );
  function load(value, name = "Pasted JSON") {
    const next = inspectSchema(value);
    setSchema(value);
    setOperations(next);
    setSelected(next[0]?.id ?? "");
    setModel("");
    setValues({});
    setBody("");
    setResult(null);
    setError("");
    setImportOpen(false);
    setSourceName(name);
    setTab("request");
    setView("operations");
    setTag("");
    setSearch("");
  }
  async function live() {
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      load(await loadExplorerSchema(abort.signal), "Connected backend");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    reloadSchema.current = live;
  });
  function choose(id) {
    setSelected(id);
    setValues({});
    setBody("");
    setBodyMode("fields");
    setResult(null);
    setError("");
    setTab("request");
  }
  function inspectModel(name) {
    setModel(name);
    setModelSearch("");
    setView("models");
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
      setTab("response");
      setResponseMode("body");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const bodySchema = operation?.request.content?.["application/json"]?.schema;
  const fields = bodySchema ? objectFields(schema, bodySchema) : {};
  let bodyObject;
  try {
    bodyObject = body.trim() ? JSON.parse(body) : {};
  } catch {
    bodyObject = null;
  }
  const fieldMode =
    fields.properties &&
    bodyObject &&
    typeof bodyObject === "object" &&
    !Array.isArray(bodyObject);
  const models = Object.keys(schema?.components?.schemas ?? {}).sort();
  const selectedModel = schema?.components?.schemas?.[model];
  return (
    <div className="api-explorer">
      <div className="ae-page-header">
        <div>
          <div className="ae-eyebrow">
            <Network size={14} /> Developer tools
          </div>
          <h1>API Explorer</h1>
          <p>Explore the contract. Build a request. Inspect the result.</p>
        </div>
        <div className="ae-header-actions">
          <button
            className="ae-button"
            disabled={busy}
            onClick={() => setImportOpen(!importOpen)}
          >
            <Upload size={15} />
            Import contract
          </button>
          <button
            className="ae-button ae-primary"
            disabled={busy}
            onClick={live}
          >
            <RefreshCw size={15} className={busy ? "ae-spinning" : ""} />
            {schema ? "Refresh backend" : "Load connected backend"}
          </button>
        </div>
      </div>
      <input
        ref={fileInput}
        className="ae-file-input"
        aria-label="Upload OpenAPI JSON"
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={async (event) => {
          try {
            const file = event.target.files[0];
            if (file) load(JSON.parse(await file.text()), file.name);
          } catch (e) {
            setError(e.message);
          } finally {
            event.target.value = "";
          }
        }}
      />
      {importOpen && (
        <section className="ae-panel ae-import">
          <div className="ae-section-heading">
            <div>
              <h2>Import a contract</h2>
              <p>OpenAPI 3 JSON from a file or the clipboard.</p>
            </div>
            <button
              className="ae-button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <FileJson size={15} />
              Choose JSON file
            </button>
          </div>
          <label htmlFor="ae-schema-source" className="ae-label">
            OpenAPI JSON
          </label>
          <textarea
            id="ae-schema-source"
            rows={6}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={'{ "openapi": "3.1.0", "paths": { … } }'}
          />
          <div className="ae-import-footer">
            <span className="ae-muted">
              Requests use the connected BSM instance, including for imported
              contracts.
            </span>
            <button
              className="ae-button ae-primary"
              disabled={busy || !source.trim()}
              onClick={() => {
                try {
                  load(JSON.parse(source));
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Load JSON
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      )}
      {error && (
        <div role="alert" className="ae-alert">
          {error}
          <button className="ae-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {busy && (
        <div role="status" className="ae-progress">
          <span>Request running…</span>
          <button
            className="ae-button"
            onClick={() => controller.current?.abort()}
          >
            <Square size={12} />
            Cancel
          </button>
        </div>
      )}
      {!schema && !importOpen && (
        <section className="ae-panel ae-welcome">
          <div className="ae-welcome-icon">
            <Braces size={32} />
          </div>
          <h2>Your API, in one workspace</h2>
          <p>
            Load the live contract to browse core and plugin endpoints with
            validated inputs and readable responses.
          </p>
          <div className="ae-welcome-steps">
            <span>
              <b>01</b> Discover operations
            </span>
            <span>
              <b>02</b> Build typed requests
            </span>
            <span>
              <b>03</b> Explore responses
            </span>
          </div>
          <small>
            Uses your current session. Executed requests perform real actions.
          </small>
        </section>
      )}
      {schema && (
        <>
          <div className="ae-contract-bar">
            <div className="ae-contract-name">
              <span className="ae-connection-dot" />
              <strong>{schema.info?.title ?? "API contract"}</strong>
              <span className="ae-tag">{schema.info?.version}</span>
              <span className="ae-muted">{sourceName}</span>
            </div>
            <span className="ae-muted">
              OpenAPI {schema.openapi} · {operations.length} operations ·{" "}
              {models.length} models
            </span>
          </div>
          <div
            className="ae-workspace-tabs"
            role="tablist"
            aria-label="Explorer workspace"
          >
            {[
              ["operations", "Operations"],
              ["models", "Models"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
              >
                {label}
                <span>
                  {id === "operations" ? operations.length : models.length}
                </span>
              </button>
            ))}
          </div>
          {view === "operations" ? (
            <div className="ae-workspace">
              <aside
                className="ae-panel ae-browser"
                aria-label="Operation browser"
              >
                <label className="ae-search">
                  <Search size={16} />
                  <input
                    aria-label="Search operations"
                    placeholder="Search operations…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter by tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">All categories</option>
                  {[
                    ...new Set(
                      operations.flatMap((item) => item.definition.tags ?? []),
                    ),
                  ]
                    .sort()
                    .map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                </select>
                <div className="ae-browser-count">
                  {matches.length}{" "}
                  {matches.length === 1 ? "operation" : "operations"}
                </div>
                <div className="ae-operation-list">
                  {[...groups].map(([name, items]) => (
                    <section key={name}>
                      <h3>
                        {name}
                        <span>{items.length}</span>
                      </h3>
                      {items.map((item) => (
                        <button
                          className="ae-operation"
                          aria-label={`${item.method} ${item.id}`}
                          title={`${item.id}\n${item.path}`}
                          disabled={busy}
                          aria-pressed={selected === item.id}
                          key={item.id}
                          onClick={() => choose(item.id)}
                        >
                          <span className="ae-operation-title">
                            <Method method={item.method} />
                            <span>
                              {item.definition.summary ||
                                item.id.replaceAll("_", " ")}
                            </span>
                          </span>
                          <code>{item.path}</code>
                        </button>
                      ))}
                    </section>
                  ))}
                </div>
                {!matches.length && (
                  <p className="ae-empty-small">
                    No operations match your filters.
                  </p>
                )}
              </aside>
              <section className="ae-panel ae-operation-panel">
                {operation ? (
                  <>
                    <div className="ae-operation-header">
                      <div className="ae-eyebrow">
                        {operation.definition.tags?.join(" / ")}
                      </div>
                      <h2>
                        {operation.definition.summary ||
                          operation.id.replaceAll("_", " ")}
                      </h2>
                      <div className="ae-endpoint">
                        <Method method={operation.method} />
                        <code>{operation.path}</code>
                      </div>
                      <div className="ae-operation-id">{operation.id}</div>
                      <div
                        className="ae-description"
                        aria-label="Operation access"
                      >
                        <p>Access: {operation.access.classification}</p>
                        <p>
                          Required permissions:{" "}
                          {operation.access.required_permissions?.join(", ") ||
                            "Not specified"}
                        </p>
                        <p>
                          Allowed roles:{" "}
                          {operation.access.allowed_roles?.join(", ") ||
                            "Unknown or contextual"}
                        </p>
                        {operation.access.additional_checks?.length > 0 && (
                          <p>
                            Additional checks:{" "}
                            {operation.access.additional_checks.join(", ")}
                          </p>
                        )}
                        <details>
                          <summary>Current account permissions</summary>
                          <p>
                            {user?.permissions?.join(", ") ||
                              "Unavailable from this backend"}
                          </p>
                        </details>
                      </div>
                      {operation.definition.description && (
                        <p className="ae-description">
                          {operation.definition.description}
                        </p>
                      )}
                    </div>
                    <div
                      className="ae-tabs"
                      role="tablist"
                      aria-label="Operation details"
                    >
                      {[
                        ["request", "Request"],
                        ["response", "Response"],
                        ["schema", "Schema"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          role="tab"
                          aria-selected={tab === id}
                          onClick={() => setTab(id)}
                        >
                          {label}
                          {id === "response" && result?.status && (
                            <span className="ae-tab-status">
                              {result.status}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {tab === "request" && (
                      <form onSubmit={execute} className="ae-request">
                        {operation.parameters.length > 0 ? (
                          <div className="ae-form-section">
                            <div className="ae-section-heading">
                              <h3>Parameters</h3>
                              <span className="ae-muted">
                                {operation.parameters.length}{" "}
                                {operation.parameters.length === 1
                                  ? "field"
                                  : "fields"}
                              </span>
                            </div>
                            {operation.parameters.map((parameter) => {
                              const key = `${parameter.in}:${parameter.name}`;
                              return (
                                <SchemaField
                                  key={`${selected}:${key}`}
                                  schema={schema}
                                  spec={parameter.schema ?? {}}
                                  name={parameter.name}
                                  location={parameter.in}
                                  required={parameter.required}
                                  value={values[key]}
                                  disabled={busy}
                                  onChange={(value) =>
                                    setValues({
                                      ...values,
                                      [key]:
                                        value === undefined
                                          ? ""
                                          : typeof value === "string"
                                            ? value
                                            : JSON.stringify(value),
                                    })
                                  }
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <p className="ae-no-parameters">
                            This operation has no parameters.
                          </p>
                        )}
                        {bodySchema && (
                          <div className="ae-form-section">
                            <div className="ae-section-heading">
                              <h3>
                                Request body
                                {operation.request.required && (
                                  <span className="ae-required">required</span>
                                )}
                              </h3>
                              <button
                                type="button"
                                className="ae-button"
                                disabled={busy}
                                onClick={() =>
                                  setBody(
                                    pretty(exampleValue(schema, bodySchema)),
                                  )
                                }
                              >
                                Fill example
                              </button>
                            </div>
                            <div className="ae-body-toolbar">
                              <div
                                className="ae-segment"
                                role="group"
                                aria-label="Body editor"
                              >
                                <button
                                  type="button"
                                  aria-pressed={bodyMode === "fields"}
                                  disabled={!fields.properties}
                                  onClick={() => setBodyMode("fields")}
                                >
                                  Fields
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={bodyMode === "json"}
                                  onClick={() => setBodyMode("json")}
                                >
                                  JSON
                                </button>
                              </div>
                              <span className="ae-type">application/json</span>
                            </div>
                            {bodyMode === "fields" && fieldMode ? (
                              Object.entries(fields.properties)
                                .filter(([, raw]) => !raw.readOnly)
                                .map(([name, raw]) => (
                                  <SchemaField
                                    key={`${selected}:${name}`}
                                    schema={schema}
                                    spec={raw}
                                    name={name}
                                    required={fields.required?.includes(name)}
                                    value={bodyObject[name]}
                                    disabled={busy}
                                    onChange={(value) => {
                                      const updated = { ...bodyObject };
                                      if (value === undefined)
                                        delete updated[name];
                                      else updated[name] = value;
                                      setBody(pretty(updated));
                                    }}
                                  />
                                ))
                            ) : (
                              <label className="ae-json-editor">
                                JSON body
                                <textarea
                                  aria-label="JSON body"
                                  disabled={busy}
                                  rows={10}
                                  value={body}
                                  onChange={(e) => setBody(e.target.value)}
                                  spellCheck={false}
                                  placeholder="Enter request JSON"
                                />
                              </label>
                            )}
                          </div>
                        )}
                        {!bodySchema && operation.request.required && (
                          <div className="ae-notice">
                            This operation requires{" "}
                            {Object.keys(operation.request.content ?? {}).join(
                              ", ",
                            )}
                            . View the schema for details; this explorer
                            currently executes JSON bodies.
                          </div>
                        )}
                        <div className="ae-request-footer">
                          <div className="ae-request-target">
                            <span className="ae-muted">Request preview</span>
                            <code>{preview?.url ?? operation.path}</code>
                            {preview?.validation && (
                              <small>{preview.validation}</small>
                            )}
                          </div>
                          <button
                            className="ae-button ae-primary"
                            disabled={busy || !preview || !!preview.validation}
                            type="submit"
                          >
                            <Play size={15} />
                            Execute {operation.method}
                          </button>
                        </div>
                        <p className="ae-action-note">
                          Runs against your connected backend with your current
                          permissions.
                        </p>
                      </form>
                    )}
                    {tab === "response" && (
                      <div className="ae-response">
                        {result ? (
                          <>
                            <div className="ae-response-meta">
                              <span
                                className={`ae-status ${result.status >= 400 || result.error ? "ae-status-error" : ""}`}
                              >
                                {result.status ??
                                  (result.error ? "Failed" : "Complete")}
                              </span>
                              <span>{result.durationMs} ms</span>
                              <span className="ae-type">
                                {result.headers?.["content-type"] ?? "Response"}
                              </span>
                            </div>
                            <div className="ae-response-toolbar">
                              <div
                                className="ae-segment"
                                role="group"
                                aria-label="Response format"
                              >
                                {[
                                  ["body", "Body"],
                                  ["headers", "Headers"],
                                  ["json", "JSON"],
                                ].map(([id, label]) => (
                                  <button
                                    type="button"
                                    key={id}
                                    aria-pressed={responseMode === id}
                                    onClick={() => setResponseMode(id)}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              <CopyButton value={pretty(result.data)} />
                            </div>
                            <h3 className="ae-sr-only">Response</h3>
                            {responseMode === "body" ? (
                              <DataView key={selected} value={result.data} />
                            ) : responseMode === "headers" ? (
                              <DataView value={result.headers ?? {}} />
                            ) : (
                              <CodeView value={result.data} />
                            )}
                          </>
                        ) : (
                          <div className="ae-empty">
                            <ArrowRight size={26} />
                            <h3>No response yet</h3>
                            <p>
                              Execute a request to inspect its status, headers,
                              and data here.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {tab === "schema" && (
                      <div className="ae-contract-details">
                        {bodySchema && (
                          <section>
                            <h3>Request model</h3>
                            <SchemaView
                              schema={schema}
                              value={bodySchema}
                              onModel={inspectModel}
                            />
                          </section>
                        )}
                        <h3>Responses</h3>
                        {Object.entries(
                          operation.definition.responses ?? {},
                        ).map(([status, raw]) => {
                          const response = resolve(schema, raw);
                          return (
                            <details
                              key={status}
                              className="ae-response-schema"
                              open={status.startsWith("2")}
                            >
                              <summary>
                                <span
                                  className={`ae-status ${status.startsWith("2") ? "" : "ae-status-neutral"}`}
                                >
                                  {status}
                                </span>
                                {response.description || "Response"}
                              </summary>
                              {Object.entries(response.content ?? {}).map(
                                ([media, content]) => (
                                  <div key={media}>
                                    <div className="ae-schema-media">
                                      {media}
                                    </div>
                                    <SchemaView
                                      schema={schema}
                                      value={content.schema ?? {}}
                                      onModel={inspectModel}
                                    />
                                  </div>
                                ),
                              )}
                            </details>
                          );
                        })}
                        <details className="ae-raw-contract">
                          <summary>Raw operation JSON</summary>
                          <CodeView value={operation.definition} />
                        </details>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ae-empty">
                    <Braces size={28} />
                    <h2>Select an operation</h2>
                    <p>
                      Browse an endpoint to see its parameters and response
                      models.
                    </p>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="ae-workspace">
              <aside className="ae-panel ae-browser">
                <label className="ae-search">
                  <Search size={16} />
                  <input
                    aria-label="Search models"
                    placeholder="Search models…"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                  />
                </label>
                <div className="ae-browser-count">{models.length} models</div>
                <div className="ae-operation-list">
                  {models
                    .filter((name) =>
                      name.toLowerCase().includes(modelSearch.toLowerCase()),
                    )
                    .map((name) => (
                      <button
                        key={name}
                        className="ae-model-item"
                        title={name}
                        aria-pressed={name === model}
                        onClick={() => setModel(name)}
                      >
                        <Braces size={14} />
                        <span>{name}</span>
                      </button>
                    ))}
                </div>
              </aside>
              <section className="ae-panel ae-model-panel">
                {selectedModel ? (
                  <>
                    <div className="ae-operation-header">
                      <div className="ae-eyebrow">Schema model</div>
                      <h2>{model}</h2>
                    </div>
                    <div className="ae-model-content">
                      <SchemaView
                        schema={schema}
                        value={selectedModel}
                        onModel={inspectModel}
                      />
                      <details className="ae-raw-contract">
                        <summary>Raw model JSON</summary>
                        <CodeView value={selectedModel} />
                      </details>
                    </div>
                  </>
                ) : (
                  <div className="ae-empty">
                    <Braces size={28} />
                    <h2>Explore typed models</h2>
                    <p>
                      Select a model to inspect its fields, types, requirements,
                      and defaults.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
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
