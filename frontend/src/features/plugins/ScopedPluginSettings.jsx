import { useAuth } from "../../contexts/AuthContext";
import { useResourceQuery } from "../../app/resourceQueries";
import QueryStatus from "../../components/QueryStatus";
import PluginSettingsEditor from "./PluginSettingsEditor";

/** @param {{ scope: "global" | "server", serverName?: string }} props */
export default function ScopedPluginSettings({ scope, serverName }) {
  const { user } = useAuth();
  const allowed = user?.role === "admin";
  const query = useResourceQuery("plugins", undefined, { enabled: allowed });
  if (!allowed || (scope === "server" && !serverName)) return null;
  const plugins = (query.data ?? []).filter((plugin) =>
    scope === "global"
      ? plugin.has_global_settings
      : plugin.has_server_settings,
  );
  return (
    <section className="settings-group">
      <h2>Plugin {scope === "global" ? "Global" : "Server"} Settings</h2>
      <p className="form-help-text">
        Each plugin saves its settings separately for{" "}
        {scope === "global" ? "this manager" : serverName}.
      </p>
      <QueryStatus query={query} />
      {plugins.map((plugin) => (
        <PluginSettingsEditor
          key={`${scope}:${serverName ?? ""}:${plugin.name}`}
          name={plugin.name}
          scope={scope}
          serverName={serverName}
        />
      ))}
      {!query.isFetching && !query.error && plugins.length === 0 && (
        <p>No plugins provide settings for this scope.</p>
      )}
    </section>
  );
}
