import { RefreshCw, Save } from "lucide-react";
import { callOperation } from "../../api/operations";
import { queryKeys } from "../../app/queryKeys";
import {
  useResourceQuery,
  useResourceMutation,
} from "../../app/resourceQueries";
import { useEditableDraft } from "../../app/useEditableDraft";
import QueryStatus from "../../components/QueryStatus";
import DraftConflictNotice from "../../components/DraftConflictNotice";
import PluginSettingsFields from "./PluginSettingsFields";
import { updateSetting } from "../../utils/settings";
import { useToast } from "../../contexts/ToastContext";
const EMPTY = {};
/** @param {{ name: string, scope?: "plugin" | "global" | "server", serverName?: string }} props */
export default function PluginSettingsEditor({
  name,
  scope = "plugin",
  serverName,
}) {
  const query = useResourceQuery(
    scope === "plugin" ? "pluginSettings" : "scopedPluginSettings",
    scope === "plugin" ? name : { name, scope, serverName },
  );
  const draft = useEditableDraft(
    scope === "plugin"
      ? `plugin-settings:${name}`
      : `plugin-settings:${scope}:${serverName ?? ""}:${name}`,
    query.data?.settings,
    EMPTY,
  );
  const { addToast } = useToast();
  const write = useResourceMutation(
    (settings, { session }) =>
      callOperation("update_plugin_settings", {
        path: { plugin_name: name },
        body: {
          settings,
          ...(scope === "plugin"
            ? {}
            : { scope, ...(serverName ? { server_name: serverName } : {}) }),
        },
        session,
      }),
    [
      queryKeys.pluginSettings(name),
      queryKeys.settings(),
      ...(serverName ? [queryKeys.serverSettings(serverName)] : []),
    ],
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
