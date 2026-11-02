import { callOperation } from "../api/operations";
import QueryStatus from "../components/QueryStatus";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Plug, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

const Plugins = () => {
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const write = useResourceMutation(
    ({ id, options }, { session }) =>
      callOperation(id, { ...options, session }),
    [queryKeys.plugins()],
  );
  /** @type {typeof callOperation} */
  const writeOperation = (id, ...args) =>
    write.mutateAsync({ id, options: args[0] });

  const resourceQuery = useResourceQuery("plugins", undefined);
  const plugins = resourceQuery.data ?? [];
  const loading = resourceQuery.isFetching || write.isPending;
  const fetchPlugins = async () => {
    const result = await resourceQuery.refetch();
    if (result.error) addToast(result.error.message, "error");
    return result.isSuccess;
  };
  const handleReload = async () => {
    addToast("Reloading plugins...", "info");
    try {
      await writeOperation("reload_plugins");
      addToast("Plugins reloaded successfully", "success");
    } catch (error) {
      addToast(error.message || "Failed to reload plugins", "error");
    }
  };
  const handleToggle = async (pluginName, currentEnabled) => {
    const newEnabled = !currentEnabled;
    try {
      // API expects POST for setting status
      await writeOperation("set_plugin_status", {
        path: { plugin_name: pluginName },
        body: {
          enabled: newEnabled,
        },
      });
      addToast(
        `Plugin ${pluginName} ${newEnabled ? "enabled" : "disabled"}.`,
        "success",
      );
    } catch (error) {
      addToast(
        error.message || `Failed to toggle plugin ${pluginName}`,
        "error",
      );
      fetchPlugins(); // Fetch fresh state to be sure.
    }
  };
  return (
    <div className="container">
      <QueryStatus query={resourceQuery} />
      <div className="header">
        <h1>Plugin Management</h1>
        <button
          className="action-button secondary"
          onClick={handleReload}
          disabled={loading}
          title="Reload all plugins"
          type="button"
        >
          <RefreshCw
            size={16}
            style={{
              marginRight: "calc(5px * var(--bsm-spacing-scale))",
            }}
            className={loading ? "spin" : ""}
          />{" "}
          Reload Plugins
        </button>
      </div>

      <div className="plugin-toolbar">
        <input
          className="form-input"
          aria-label="Search plugins"
          type="search"
          placeholder="Search plugins…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="form-input"
          aria-label="Plugin status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All plugins ({plugins.length})</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="loaded">Loaded</option>
          <option value="unloaded">Unloaded</option>
          <option value="error">Errors</option>
        </select>
        <Link className="action-button secondary" to="/plugin-settings">
          Plugin Settings
        </Link>
      </div>
      {resourceQuery.isPending && <p role="status">Loading plugins…</p>}
      <div className="plugin-grid">
        {plugins
          .filter(
            (plugin) =>
              `${plugin.name} ${plugin.description} ${plugin.author} ${(plugin.permissions ?? []).join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (filter === "all" ||
                (filter === "enabled" && plugin.enabled) ||
                (filter === "disabled" && !plugin.enabled) ||
                (filter === "loaded" && plugin.status === "LOADED") ||
                (filter === "unloaded" && plugin.status === "UNLOADED") ||
                (filter === "error" && plugin.status === "ERROR")),
          )
          .map((plugin) => (
            <article className="plugin-card" key={plugin.name}>
              <div className="plugin-card-heading">
                <Plug size={20} />
                <h3>{plugin.name}</h3>
                <span className="status-badge" title="Configured state">
                  {plugin.enabled ? "Enabled" : "Disabled"}
                </span>
                <span className="status-badge" title="Runtime status">
                  {plugin.status || "UNKNOWN"}
                </span>
              </div>
              <p>{plugin.description || "No description provided."}</p>
              <div className="plugin-settings-scopes">
                <strong>Settings scopes</strong>
                <span>
                  {[
                    plugin.has_settings && "Plugin",
                    plugin.has_global_settings && "Global",
                    plugin.has_server_settings && "Server",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"}
                </span>
              </div>
              <details className="plugin-permissions">
                <summary>
                  Declared permissions ({(plugin.permissions ?? []).length})
                </summary>
                <p className="form-help-text">
                  Capabilities declared by this plugin for backend API and
                  filesystem access.
                </p>
                {plugin.permissions?.length ? (
                  <ul>
                    {plugin.permissions.map((permission) => (
                      <li key={permission}>
                        <code>{permission}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No permissions declared.</p>
                )}
              </details>
              <div className="plugin-card-footer">
                <span>v{plugin.version || "N/A"}</span>
                <span>{plugin.author || "Unknown Author"}</span>
              </div>
              <div className="plugin-card-heading">
                {plugin.has_settings && (
                  <Link
                    className="action-button secondary"
                    to={`/plugin-settings?plugin=${encodeURIComponent(plugin.name)}`}
                  >
                    Settings
                  </Link>
                )}
                <button
                  className="action-button secondary"
                  disabled={loading}
                  onClick={() => handleToggle(plugin.name, plugin.enabled)}
                  title={plugin.enabled ? "Disable" : "Enable"}
                  type="button"
                >
                  {plugin.enabled ? (
                    <ToggleRight size={18} />
                  ) : (
                    <ToggleLeft size={18} />
                  )}{" "}
                  {plugin.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </article>
          ))}
      </div>
      {!resourceQuery.isPending && plugins.length === 0 && (
        <p>No plugins installed.</p>
      )}
    </div>
  );
};
export default Plugins;
