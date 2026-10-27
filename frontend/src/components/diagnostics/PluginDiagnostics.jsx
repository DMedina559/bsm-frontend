import { useState } from "react";
import { Search, Puzzle, Info } from "lucide-react";
import DiagnosticDetails from "./DiagnosticDetails";
import { displayValue, pluginStatusLabel } from "./format";

export default function PluginDiagnostics({ data }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const plugins = data.plugins ?? [];
  const filtered = plugins.filter((plugin) =>
    plugin.name.toLowerCase().includes(search.toLowerCase()),
  );
  const plugin = filtered.find((item) => item.name === selected) ?? filtered[0];
  return (
    <div>
      <p className="monitor-muted">
        {displayValue(data.total)} registered plugins
        {data.truncated ? " · List limited by the backend" : ""}
      </p>
      <div className="diagnostic-plugin-browser">
        <div>
          <label className="diagnostic-plugin-search">
            <Search size={18} aria-hidden="true" />
            <input
              className="form-input"
              type="search"
              aria-label="Search plugins"
              placeholder="Search plugins…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <ul className="diagnostic-plugin-list">
            {filtered.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  aria-pressed={item.name === plugin?.name}
                  onClick={() => setSelected(item.name)}
                >
                  <Puzzle size={18} aria-hidden="true" />
                  <span>{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p>
              {plugins.length
                ? "No plugins match your search."
                : "No registered plugins in this observation."}
            </p>
          )}
        </div>
        {plugin && (
          <section
            className="diagnostic-plugin-detail"
            aria-label={`${plugin.name} plugin details`}
          >
            <h3>{plugin.name}</h3>
            <span
              className={`diagnostic-status diagnostic-plugin-status-${String(plugin.status ?? "unknown").toLowerCase()}`}
            >
              {pluginStatusLabel(plugin.status)}
            </span>
            {(plugin.status?.toUpperCase() === "UNKNOWN" || !plugin.status) && (
              <p className="diagnostic-notice">
                <Info size={18} aria-hidden="true" />
                The backend could not resolve a runtime status for this
                registered plugin. This does not confirm that it is loaded.
              </p>
            )}
            {plugin.draining && (
              <p role="status">Waiting for owned work to drain.</p>
            )}
            <dl className="diagnostic-values">
              {[
                ["Version", plugin.version],
                ["Active tasks", plugin.active_tasks],
                ["Managed tasks", plugin.managed_tasks],
                ["Listeners", plugin.listeners],
                ["Workers", plugin.workers],
                ["Diagnostic providers", plugin.diagnostic_providers],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{displayValue(value)}</dd>
                </div>
              ))}
            </dl>
            <details>
              <summary>Lifecycle details</summary>
              <DiagnosticDetails
                value={{
                  generation: plugin.generation,
                  draining: plugin.draining,
                  last_transition_at: plugin.last_transition_at,
                  load_failures: plugin.load_failures,
                  drain_failures: plugin.drain_failures,
                  last_drain_duration_ms: plugin.last_drain_duration_ms,
                }}
              />
              <p className="monitor-muted">
                Timestamps and durations appear once the backend records the
                corresponding operation.
              </p>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
