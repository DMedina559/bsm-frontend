import { callOperation } from "../api/operations";
import { getScopeCategory } from "../utils/scopeCategory";
import QueryStatus from "../components/QueryStatus";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plug,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Search,
  Settings,
} from "lucide-react";
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
  const filteredPlugins = plugins.filter(
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
  );
  return (
    <div className="container plugins-page">
      <QueryStatus query={resourceQuery} />
      <div className="header">
        <div>
          <h1>Plugin Management</h1>
          <p className="plugin-page-description">
            Manage installed plugins and inspect their capabilities.
          </p>
        </div>
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
        <label className="plugin-search">
          <Search size={18} aria-hidden="true" />
          <input
            className="form-input"
            aria-label="Search plugins"
            type="search"
            placeholder="Search plugins…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
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
          <Settings size={16} aria-hidden="true" /> Plugin Settings
        </Link>
      </div>
      {resourceQuery.isPending && <p role="status">Loading plugins…</p>}
      <div className="plugin-grid">
        {filteredPlugins.map((plugin) => (
          <article className="plugin-card" key={plugin.name}>
            <div className="plugin-card-heading">
              <span className="plugin-card-icon">
                <Plug size={20} aria-hidden="true" />
              </span>
              <h3>{plugin.name}</h3>
            </div>
            <div className="plugin-card-statuses">
              <span className="plugin-state" title="Configured state">
                {plugin.enabled ? "Enabled" : "Disabled"}
              </span>
              <span
                className={`plugin-state plugin-runtime-${(plugin.status || "UNKNOWN").toLowerCase()}`}
                title="Runtime status"
              >
                {plugin.status || "UNKNOWN"}
              </span>
            </div>
            <p className="plugin-card-description">
              {plugin.description || "No description provided."}
            </p>
            <div className="plugin-settings-scopes">
              <span className="plugin-meta-label">Settings scopes</span>
              <span className="plugin-scope-badges">
                {[
                  plugin.has_settings && "Plugin",
                  plugin.has_global_settings && "Global",
                  plugin.has_server_settings && "Server",
                ]
                  .filter(Boolean)
                  .map((scope) => (
                    <span className="plugin-scope-badge" key={scope}>
                      {scope}
                    </span>
                  ))}
                {!plugin.has_settings &&
                  !plugin.has_global_settings &&
                  !plugin.has_server_settings && (
                    <span className="plugin-scope-badge plugin-scope-none">
                      None
                    </span>
                  )}
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
                <ul className="plugin-permission-list">
                  {plugin.permissions.map((permission) => (
                    <li
                      key={permission}
                      data-scope={permission}
                      data-category={getScopeCategory(permission)}
                    >
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
            <div className="plugin-card-actions">
              {plugin.has_settings && (
                <Link
                  className="action-button secondary"
                  to={`/plugin-settings?plugin=${encodeURIComponent(plugin.name)}`}
                >
                  <Settings size={16} aria-hidden="true" /> Settings
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
      {!resourceQuery.isPending &&
        !resourceQuery.error &&
        filteredPlugins.length === 0 && (
          <div className="plugin-empty-state">
            <Plug size={28} aria-hidden="true" />
            <p>
              {plugins.length
                ? "No plugins match your search or filter."
                : "No plugins installed."}
            </p>
            {plugins.length > 0 && (
              <button
                type="button"
                className="action-button secondary"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
    </div>
  );
};
export default Plugins;
