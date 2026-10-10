import { callOperation } from "../api/operations";
import QueryStatus from "../components/QueryStatus";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import React from "react";
import { Plug, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "../ToastContext";

const Plugins = () => {
  const { addToast } = useToast();
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
              marginRight: "5px",
            }}
            className={loading ? "spin" : ""}
          />{" "}
          Reload Plugins
        </button>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
          }}
        >
          <RefreshCw
            className="spin"
            style={{
              display: "inline-block",
              marginRight: "10px",
            }}
          />{" "}
          Loading plugins...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {plugins.length === 0 ? (
            <p
              style={{
                color: "var(--text-color-secondary)",
              }}
            >
              No plugins installed.
            </p>
          ) : (
            plugins.map((plugin) => (
              <div
                key={plugin.name}
                style={{
                  background: "var(--container-background-color, #333)",
                  border: "1px solid var(--border-color, #555)",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <Plug size={20} />
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.1em",
                      }}
                    >
                      {plugin.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleToggle(plugin.name, plugin.enabled)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: plugin.enabled
                        ? "var(--primary-button-background-color)"
                        : "var(--text-color-secondary)",
                    }}
                    title={plugin.enabled ? "Disable" : "Enable"}
                    type="button"
                    aria-label={plugin.enabled ? "Disable" : "Enable"}
                  >
                    {plugin.enabled ? (
                      <ToggleRight size={32} />
                    ) : (
                      <ToggleLeft size={32} />
                    )}
                  </button>
                </div>

                <p
                  style={{
                    margin: "5px 0",
                    color: "var(--text-color-secondary)",
                    fontSize: "0.9em",
                    flexGrow: 1,
                  }}
                >
                  {plugin.description || "No description provided."}
                </p>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "15px",
                    fontSize: "0.85em",
                    color: "var(--text-color-secondary)",
                    borderTop: "1px solid var(--border-color, #555)",
                    paddingTop: "10px",
                  }}
                >
                  <span>v{plugin.version || "N/A"}</span>
                  <span>{plugin.author || "Unknown Author"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
export default Plugins;
