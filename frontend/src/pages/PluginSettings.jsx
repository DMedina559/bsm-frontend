import { useSearchParams } from "react-router-dom";
import { Save, RefreshCw } from "lucide-react";
import { callOperation } from "../api/operations";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import { useEditableDraft } from "../app/useEditableDraft";
import QueryStatus from "../components/QueryStatus";
import DraftConflictNotice from "../components/DraftConflictNotice";
import PluginSettingsFields from "../features/plugins/PluginSettingsFields";
import { updateSetting } from "../utils/settings";
import { useDialog } from "../contexts/DialogContext";
import { useToast } from "../contexts/ToastContext";
const EMPTY = {};
function PluginEditor({ name }) {
  const query = useResourceQuery("pluginSettings", name);
  const draft = useEditableDraft(
    `plugin-settings:${name}`,
    query.data?.settings,
    EMPTY,
  );
  const { addToast } = useToast();
  const write = useResourceMutation(
    (settings, { session }) =>
      callOperation("update_plugin_settings", {
        path: { plugin_name: name },
        body: { settings },
        session,
      }),
    [queryKeys.pluginSettings(name), queryKeys.settings()],
  );
  async function save(event) {
    event.preventDefault();
    if (draft.conflicted || write.isPending) return;
    try {
      const submitted = draft.value;
      await write.mutateAsync(submitted);
      draft.markSaved(submitted);
      addToast("Plugin settings saved.", "success");
    } catch (error) {
      addToast(error.message || "Could not save settings.", "error");
    }
  }
  return (
    <>
      <QueryStatus query={query} />
      <DraftConflictNotice draft={draft} />
      <form onSubmit={save}>
        <fieldset
          className="form-fields"
          disabled={query.isFetching || write.isPending || !!query.error}
        >
          <section className="settings-group">
            <div className="plugin-editor-heading">
              <h2>{name}</h2>
              <button
                type="button"
                className="action-button secondary"
                onClick={() =>
                  draft.refresh(async () => {
                    const result = await query.refetch();
                    return { ...result, data: result.data?.settings };
                  })
                }
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
            {query.data && (
              <PluginSettingsFields
                key={JSON.stringify(query.data.settings)}
                values={draft.value}
                schema={query.data.settings_schema}
                onChange={(path, value) =>
                  draft.setValue((previous) =>
                    path ? updateSetting(previous, path, value) : value,
                  )
                }
              />
            )}
          </section>
          <div className="form-actions">
            <span className="form-help-text">
              {draft.dirty
                ? "Unsaved changes"
                : "Changes apply when the plugin reads its settings."}
            </span>
            <button
              className="action-button"
              type="submit"
              disabled={!draft.dirty || write.isPending || draft.conflicted}
            >
              <Save size={16} />
              {write.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
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
            <PluginEditor key={selected} name={selected} />
          </div>
        </>
      ) : (
        !query.isFetching && <p>No plugins provide settings.</p>
      )}
    </div>
  );
}
