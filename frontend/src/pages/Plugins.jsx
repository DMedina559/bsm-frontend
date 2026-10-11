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
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
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
          <option value="error">Errors</option>
        </select>
        <Link className="action-button secondary" to="/plugin-settings">
          Plugin Settings
        </Link>
      </div>
      {resourceQuery.isPending && <p>Loading plugins…</p>}
      <div className="plugin-grid">
        {plugins
          .filter(
            (plugin) =>
              `${plugin.name} ${plugin.description} ${plugin.author}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (filter === "all" ||
                (filter === "enabled" && plugin.enabled) ||
                (filter === "disabled" && !plugin.enabled) ||
                (filter === "error" && plugin.status === "ERROR")),
          )
          .map((plugin) => (
            <article className="plugin-card" key={plugin.name}>
              <div className="plugin-card-heading">
                <Plug size={20} />
                <h3>{plugin.name}</h3>
                <span className="status-badge">
                  {plugin.status === "UNKNOWN" || !plugin.status
                    ? plugin.enabled
                      ? "Enabled"
                      : "Disabled"
                    : plugin.status}
                </span>
              </div>
              <p>{plugin.description || "No description provided."}</p>
              <div className="plugin-card-footer">
                <span>v{plugin.version || "N/A"}</span>
                <span>{plugin.author || "Unknown Author"}</span>
              </div>
              <div className="plugin-card-heading">
                <Link
                  className="action-button secondary"
                  to={`/plugin-settings?plugin=${encodeURIComponent(plugin.name)}`}
                >
                  Settings
                </Link>
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
