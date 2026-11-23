import { useSearchParams } from "react-router-dom";
import { useResourceQuery } from "../app/resourceQueries";
import QueryStatus from "../components/QueryStatus";
import PluginSettingsEditor from "../features/plugins/PluginSettingsEditor";
import { useDialog } from "../contexts/DialogContext";
export default function PluginSettings() {
  const query = useResourceQuery("plugins");
  const plugins = (query.data ?? []).filter((plugin) => plugin.has_settings);
  const [params, setParams] = useSearchParams();
  const selected =
    plugins.find((plugin) => plugin.name === params.get("plugin"))?.name ??
    plugins[0]?.name;
  const { confirmAction } = useDialog();
  async function select(name) {
    const { draftRegistry } = await import("../app/draftRegistry");
    if (
      name !== selected &&
      draftRegistry.dirty() &&
      !(await confirmAction("Discard unsaved plugin settings?"))
    )
      return;
    setParams({ plugin: name });
  }
  return (
    <div className="container">
      <div className="header">
        <h1>Plugin Settings</h1>
      </div>
      <p className="form-help-text">
        Configure each plugin independently, including disabled plugins.
      </p>
      <QueryStatus query={query} />
      {plugins.length ? (
        <>
          <div className="tabs" role="tablist" aria-label="Plugins">
            {plugins.map((plugin, index) => (
              <button
                id={`plugin-tab-${index}`}
                key={plugin.name}
                type="button"
                role="tab"
                aria-selected={selected === plugin.name}
                aria-controls="plugin-settings-panel"
                tabIndex={selected === plugin.name ? 0 : -1}
                className={`tab-button ${selected === plugin.name ? "active" : ""}`}
                onClick={() => select(plugin.name)}
                onKeyDown={(event) => {
                  let next;
                  if (event.key === "ArrowRight")
                    next = (index + 1) % plugins.length;
                  if (event.key === "ArrowLeft")
                    next = (index + plugins.length - 1) % plugins.length;
                  if (event.key === "Home") next = 0;
                  if (event.key === "End") next = plugins.length - 1;
                  if (next !== undefined) {
                    event.preventDefault();
                    void select(plugins[next].name);
                    document.getElementById(`plugin-tab-${next}`)?.focus();
                  }
                }}
              >
                {plugin.name}
              </button>
            ))}
          </div>
          <div
            id="plugin-settings-panel"
            role="tabpanel"
            aria-labelledby={`plugin-tab-${plugins.findIndex((plugin) => plugin.name === selected)}`}
          >
            <PluginSettingsEditor key={selected} name={selected} />
          </div>
        </>
      ) : (
        !query.isFetching && <p>No plugins provide settings.</p>
      )}
    </div>
  );
}
