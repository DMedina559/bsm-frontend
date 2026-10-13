import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Download } from "lucide-react";
import { callOperation } from "../../api/operations";
import { useResourceQuery } from "../../app/resourceQueries";
import { validateDiagnosticSnapshot } from "../../app/diagnostics";
import { sessionRuntime } from "../../app/sessionRuntime";
import QueryStatus from "../QueryStatus";
import DiagnosticDetails from "./DiagnosticDetails";
import { dateValue, displayValue, labelFor } from "./format";
import Status from "./Status";
import DiagnosticHistory from "./DiagnosticHistory";
import "../../styles/diagnostics.css";

const actions = {
  inspect_logs: "Review the application logs.",
  inspect_events: "Review event listener outcomes.",
  inspect_storage: "Review storage and persistence observations.",
  inspect_plugins: "Review plugin load and drain status.",
  wait_for_drain: "Wait for active callbacks to finish draining.",
  check_configuration: "Review the application configuration.",
};
export default function ApplicationDiagnostics() {
  const [automatic, setAutomatic] = useState(false);
  const [section, setSection] = useState("all");
  const [baseline, setBaseline] = useState(
    /** @type {import("../../api/generated/contract").components["schemas"]["DiagnosticSnapshot"] | null} */ (
      null
    ),
  );
  const [traceDraft, setTraceDraft] = useState("");
  const [correlation, setCorrelation] = useState("");
  const traceHeading = useRef(null);
  const controller = useRef(/** @type {AbortController | null} */ (null));
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  const query = useResourceQuery("diagnostics", undefined, {
    retry: false,
    refetchInterval: automatic ? 15000 : false,
    refetchIntervalInBackground: false,
  });
  const trace = useResourceQuery("diagnosticTrace", correlation, {
    enabled: !!correlation,
    retry: false,
  });
  const snapshot = query.data;
  const report = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const session = sessionRuntime.capture();
      const signal = controller.current?.signal;
      if (!signal) throw new DOMException("View closed", "AbortError");
      const data = await callOperation("get_diagnostic_report", { signal });
      if (!sessionRuntime.isCurrent(session) || signal.aborted)
        throw new DOMException("Session changed", "AbortError");
      if (!data?.snapshot || typeof data.report_id !== "string")
        throw new Error("The backend returned an invalid support report.");
      validateDiagnosticSnapshot(data.snapshot);
      const revoke = URL.revokeObjectURL.bind(URL);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bsm-diagnostics-${data.report_id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => revoke(url), 1000);
    },
  });
  const compare = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      const session = sessionRuntime.capture();
      const signal = controller.current?.signal;
      if (!signal || !baseline || !snapshot)
        throw new Error("Save a baseline and collect observations first.");
      const result = await callOperation("compare_diagnostic_snapshots", {
        body: { before: baseline, after: snapshot },
        signal,
      });
      if (!sessionRuntime.isCurrent(session) || signal.aborted)
        throw new DOMException("Session changed", "AbortError");
      if (
        typeof result?.same_instance !== "boolean" ||
        !Array.isArray(result.changes)
      )
        throw new Error("Invalid diagnostic comparison response");
      return result;
    },
  });
  const inspectTrace = (id) => {
    setTraceDraft(id);
    traceHeading.current?.scrollIntoView?.({
      block: "start",
      behavior: "smooth",
    });
    traceHeading.current?.focus({ preventScroll: true });
    if (correlation === id) void trace.refetch();
    else setCorrelation(id);
  };
  return (
    <div className="diagnostics-view">
      <div className="application-monitor-heading">
        <div>
          <h1>Diagnostics</h1>
          <p>
            Runtime observations and retained history · administrator access
          </p>
        </div>
        <div className="diagnostic-actions">
          <button
            type="button"
            className="action-button secondary"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" /> Refresh observations
          </button>
          <button
            type="button"
            className="action-button secondary"
            disabled={report.isPending}
            onClick={() => report.mutate()}
          >
            <Download size={16} aria-hidden="true" />{" "}
            {report.isPending ? "Preparing report…" : "Download support report"}
          </button>
        </div>
      </div>
      <p className="application-metrics-hint">
        Metadata only; event payloads and task arguments are excluded. Review
        reports before sharing. Observations are collected independently.
      </p>
      <label className="diagnostic-refresh">
        <input
          type="checkbox"
          checked={automatic}
          onChange={(e) => setAutomatic(e.target.checked)}
        />{" "}
        Refresh observations every 15 seconds while this tab is visible
      </label>
      <QueryStatus query={query} />
      {query.error?.status === 404 && (
        <p>
          This backend does not expose diagnostics. Update the backend to use
          this view.
        </p>
      )}
      {query.isPending && <p role="status">Collecting observations…</p>}
      {report.error && <p role="alert">{report.error.message}</p>}
      {snapshot && (
        <>
          <dl className="application-metric-grid diagnostic-summary">
            <div>
              <dt>Overall health</dt>
              <dd>
                <Status value={snapshot.summary.status} />
              </dd>
            </div>
            <div>
              <dt>Application readiness</dt>
              <dd>
                {snapshot.summary.ready === null
                  ? "Not observed"
                  : snapshot.summary.ready
                    ? "Ready"
                    : "Not ready"}
              </dd>
            </div>
            <div>
              <dt>Collected</dt>
              <dd>{dateValue(snapshot.collected_at)}</dd>
            </div>
            <div>
              <dt>Recent failures / timeouts</dt>
              <dd>
                {displayValue(snapshot.recent?.failures)} /{" "}
                {displayValue(snapshot.recent?.timeouts)}
              </dd>
            </div>
          </dl>
          <p className="application-metrics-hint">
            Instance {snapshot.instance_id} · live counters reset on restart.
            Recent counts use ten-second buckets over five minutes.
          </p>
          {!!snapshot.summary.findings?.length && (
            <section
              className="diagnostic-findings"
              aria-label="Diagnostic findings"
            >
              <h2>Needs attention</h2>
              {snapshot.summary.findings.map((finding, index) => (
                <article
                  key={`${finding.subsystem}:${finding.issue.code}:${index}`}
                >
                  <strong>{labelFor(finding.subsystem)}</strong>
                  <p>{finding.issue.message}</p>
                  <small>
                    {actions[finding.issue.action] ??
                      "Inspect this subsystem's observations."}
                  </small>
                </article>
              ))}
            </section>
          )}
          {snapshot.summary.truncated && (
            <p>Some findings were omitted from this bounded observation.</p>
          )}
          <div className="diagnostic-actions">
            <button
              type="button"
              className="action-button secondary"
              onClick={() => {
                setBaseline(structuredClone(snapshot));
                compare.reset();
              }}
            >
              Save comparison baseline
            </button>
            <button
              type="button"
              className="action-button secondary"
              disabled={!baseline || compare.isPending}
              onClick={() => compare.mutate()}
            >
              Compare with baseline
            </button>
            {baseline && (
              <span>Baseline: {dateValue(baseline.collected_at)}</span>
            )}
          </div>
          {compare.error && <p role="alert">{compare.error.message}</p>}
          {compare.data && (
            <section aria-label="Snapshot comparison">
              <h2>Changes since baseline</h2>
              <p>
                {compare.data.same_instance
                  ? "Same application instance."
                  : "Application instance changed; counter deltas are unavailable."}
              </p>
              <DiagnosticDetails value={compare.data.changes} />
              {!compare.data.changes?.length && (
                <p>No changes in compared fields.</p>
              )}
              {compare.data.truncated && (
                <p>The comparison was limited to 200 changes.</p>
              )}
            </section>
          )}
          <label className="diagnostic-section-picker">
            Subsystem
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="all">All subsystems</option>
              {snapshot.sections.map((item) => (
                <option key={item.name} value={item.name}>
                  {labelFor(item.name)}
                </option>
              ))}
            </select>
          </label>
          <div className="diagnostic-sections">
            {snapshot.sections
              .filter((item) => section === "all" || item.name === section)
              .map((item) => (
                <section
                  className="diagnostic-card"
                  key={item.name}
                  aria-label={`${labelFor(item.name)} diagnostics`}
                >
                  <h2>
                    {labelFor(item.name)} <Status value={item.status} />
                  </h2>
                  <p className="application-metrics-hint">
                    Owner: {item.owner} ·{" "}
                    {item.stale ? "Stale reading" : "Reading age at collection"}
                    :{" "}
                    {Number.isFinite(item.age_seconds)
                      ? `${item.age_seconds.toFixed(1)} seconds old`
                      : "Not observed"}{" "}
                    · Last successful collection:{" "}
                    {dateValue(item.last_success_at)}
                  </p>
                  {item.issues?.map((issue) => (
                    <p key={issue.code}>{issue.message}</p>
                  ))}
                  {item.data?.truncated && (
                    <p>
                      Details were limited; totals may exceed the displayed
                      entries.
                    </p>
                  )}
                  <DiagnosticDetails value={item.data} />
                </section>
              ))}
          </div>
          <section
            className="diagnostic-card"
            aria-label="Diagnostic collection and environment"
          >
            <h2>Diagnostics and installation</h2>
            <DiagnosticDetails
              value={{
                collection: snapshot.collection,
                persistence: snapshot.persistence,
                providers: snapshot.registry,
                environment: snapshot.environment,
                recent: snapshot.recent,
              }}
            />
          </section>
        </>
      )}
      <section
        className="diagnostic-trace"
        aria-labelledby="diagnostic-trace-heading"
      >
        <h2 id="diagnostic-trace-heading" ref={traceHeading} tabIndex={-1}>
          Correlated trace
        </h2>
        <form
          className="diagnostic-filters"
          onSubmit={(e) => {
            e.preventDefault();
            if (correlation === traceDraft.trim()) void trace.refetch();
            else setCorrelation(traceDraft.trim());
          }}
        >
          <label>
            Trace correlation ID
            <input
              value={traceDraft}
              maxLength={160}
              onChange={(e) => setTraceDraft(e.target.value)}
            />
          </label>
          <button
            className="action-button secondary"
            type="submit"
            disabled={!traceDraft.trim()}
          >
            Inspect trace
          </button>
        </form>
        {correlation && (
          <>
            <QueryStatus query={trace} />
            {trace.isPending && <p role="status">Loading trace…</p>}
            {trace.data && (
              <>
                <p>
                  Events:{" "}
                  {trace.data.events_available ? "available" : "unavailable"} ·
                  Tasks:{" "}
                  {trace.data.tasks_available ? "available" : "unavailable"} ·
                  History:{" "}
                  {trace.data.history?.available ? "available" : "unavailable"}
                </p>
                {trace.data.issues?.map((issue) => (
                  <p key={issue.code}>{issue.message}</p>
                ))}
                <DiagnosticDetails
                  value={{
                    events: trace.data.events,
                    tasks: trace.data.tasks,
                    history: trace.data.history,
                  }}
                />
                {trace.data.truncated && (
                  <p>
                    This trace is partial; use history filters to inspect
                    additional retained records.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>
      <DiagnosticHistory
        onTrace={inspectTrace}
        instance={snapshot?.instance_id}
      />
    </div>
  );
}
