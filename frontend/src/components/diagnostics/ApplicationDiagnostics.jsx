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
import DiagnosticSubsystem from "./DiagnosticSubsystem";
import { subsystemDescriptions } from "./subsystems";
import MonitorNavigation from "../metrics/MonitorNavigation";
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
  const [view, setView] = useState("overview");
  const [historyVisited, setHistoryVisited] = useState(false);
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
    enabled: view === "history" && !!correlation,
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
          <h2 className="monitor-view-title">Diagnostics</h2>
          <p>Runtime observations and retained history</p>
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
      <MonitorNavigation
        label="Diagnostic categories"
        active={view}
        onChange={(next) => {
          setView(next);
          if (next === "history") setHistoryVisited(true);
        }}
        items={[
          ["overview", "Overview"],
          ["subsystems", "Subsystems"],
          ["history", "History"],
          ["advanced", "Advanced"],
        ]}
      />
      <label className="diagnostic-refresh">
        <input
          type="checkbox"
          checked={automatic}
          onChange={(e) => setAutomatic(e.target.checked)}
        />{" "}
        Auto-refresh every 15 seconds
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
          <p className="monitor-muted">
            Live counters reset on restart. Recent failures cover the last five
            minutes.
          </p>
          {view === "overview" && (
            <>
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
              {!snapshot.summary.findings?.length && (
                <section
                  className="diagnostic-card"
                  aria-label="Diagnostic findings"
                >
                  <h2>Needs attention</h2>
                  <p>No findings reported in this snapshot.</p>
                  <p className="monitor-muted">
                    Unassessed or unavailable subsystems may still need
                    inspection.
                  </p>
                </section>
              )}
              <section aria-label="Subsystem overview">
                <h2>Subsystems at a glance</h2>
                <div className="diagnostic-overview-grid">
                  {snapshot.sections.map((item) => (
                    <button
                      type="button"
                      key={item.name}
                      className="diagnostic-overview-item"
                      onClick={() => {
                        setSection(item.name);
                        setView("subsystems");
                      }}
                    >
                      <span>
                        <strong>{labelFor(item.name)}</strong>
                        <small>
                          {subsystemDescriptions[
                            item.data?.kind ?? item.name
                          ] ?? "Provider observations"}
                        </small>
                      </span>
                      <Status value={item.status} />
                      {item.stale && <small>Stale reading</small>}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "advanced" && (
            <>
              <h2>Snapshot comparison</h2>
              <p className="monitor-muted">
                Save a baseline in this view, collect fresh observations, then
                compare. The baseline is discarded when you leave Diagnostics or
                change account.
              </p>
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
            </>
          )}
          {view === "subsystems" && (
            <>
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
                    <DiagnosticSubsystem key={item.name} item={item} />
                  ))}
              </div>
            </>
          )}
          {view === "advanced" && (
            <>
              <section
                className="diagnostic-card"
                aria-label="Diagnostic collection and environment"
              >
                <h2>Diagnostics and installation</h2>
                <p className="monitor-muted">Instance {snapshot.instance_id}</p>
                <p>
                  Metadata only; event payloads and task arguments are excluded.
                  Review support reports before sharing.
                </p>
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
        </>
      )}
      {historyVisited && (
        <div hidden={view !== "history"}>
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
                      {trace.data.events_available
                        ? "available"
                        : "unavailable"}{" "}
                      · Tasks:{" "}
                      {trace.data.tasks_available ? "available" : "unavailable"}{" "}
                      · History:{" "}
                      {trace.data.history?.available
                        ? "available"
                        : "unavailable"}
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
            active={view === "history"}
          />
        </div>
      )}
    </div>
  );
}
