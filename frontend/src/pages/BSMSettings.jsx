import { useSearchParams } from "react-router-dom";
import BackupSettings from "../components/BackupSettings";
import "../styles/backup-settings.css";
import DraftConflictNotice from "../components/DraftConflictNotice";
import { callOperation } from "../api/operations";
import { useEditableDraft } from "../app/useEditableDraft";
import QueryStatus from "../components/QueryStatus";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import SettingsGroups from "../components/SettingsGroups";
import {
  changedSettings,
  updateSetting,
  isSafeSettingPath,
} from "../utils/settings";
import React, { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

import { logger } from "../utils/logger";
const EMPTY_SETTINGS = {};
const BSMSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = ["general", "backups", "web", "storage", "advanced"];
  const activeTab = tabs.includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "general";
  const tabGroups = {
    general: ["general", "monitoring", "lifecycle"],
    web: ["web"],
    storage: ["paths", "retention"],
    advanced: ["custom", "diagnostics"],
  };
  const groupedKeys = new Set([
    "backups",
    "plugin_settings",
    "config_schema_version",
    ...Object.values(tabGroups).flat(),
  ]);
  const resourceQuery = useResourceQuery("settings");
  const draft = useEditableDraft(
    "settings",
    resourceQuery.data,
    EMPTY_SETTINGS,
  );
  const {
    value: settings,
    setValue: setSettings,
    savedSnapshot,
    markSaved,
  } = draft;
  const loading = resourceQuery.isFetching;
  const [loadError, setLoadError] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const { addToast } = useToast();
  const write = useResourceMutation(
    async ({ id, options, entries }, { session }) => {
      if (entries) {
        for (const [key, value] of entries)
          await callOperation("set_setting", { body: { key, value }, session });
        return;
      }
      return callOperation(id, { ...options, session });
    },
    [queryKeys.settings(), queryKeys.applicationInfo()],
  );
  /** @type {typeof callOperation} */
  const writeOperation = (id, ...args) =>
    write.mutateAsync({ id, options: args[0] });

  const saving = write.isPending;

  useEffect(() => {
    setLoadError(resourceQuery.error?.message ?? null);
  }, [resourceQuery.error]);
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving || draft.conflicted) return;

    try {
      await write.mutateAsync({
        entries: [
          ...changedSettings(settings, savedSnapshot).filter(
            ([key]) => !key.startsWith("backups."),
          ),
          ...(JSON.stringify(settings.backups) !==
          JSON.stringify(JSON.parse(savedSnapshot ?? "{}").backups)
            ? [["backups", settings.backups]]
            : []),
        ],
      });
      markSaved(settings);
      addToast("Settings saved successfully.", "success");
    } catch (error) {
      logger.error("[BSMSettings] Save settings error", {
        error,
      });
      addToast(error.message || "Failed to save settings.", "error");
    }
  };
  const handleReload = async () => {
    try {
      const refreshed = await draft.refresh(async () => {
        await writeOperation("reload_settings");
        return resourceQuery.refetch();
      });
      if (refreshed) addToast("Settings reloaded from disk.", "success");
    } catch (error) {
      addToast(error.message || "Failed to reload settings.", "error");
    }
  };
  const handleChange = (path, value) =>
    setSettings((previous) => updateSetting(previous, path, value));
  const handleAddCustom = (e) => {
    e.preventDefault();
    if (saving) return;
    if (!newKey.trim()) {
      addToast("Key cannot be empty", "error");
      return;
    }
    if (!isSafeSettingPath(newKey.trim())) {
      addToast(
        "Use a valid setting key without reserved path segments.",
        "error",
      );
      return;
    }
    const fullKey = `custom.${newKey.trim()}`;
    // Check if key already exists (basic check)
    // We update local state, save will handle persistence
    handleChange(fullKey, newValue);
    setNewKey("");
    setNewValue("");
    addToast(`Added ${fullKey} to pending changes.`, "info");
  };
  return (
    <div className="container">
      <DraftConflictNotice draft={draft} />
      <QueryStatus query={resourceQuery} />
      <div className="header">
        <h1>Global Settings</h1>
        <button
          className="action-button secondary"
          onClick={handleReload}
          disabled={loading || saving}
          type="button"
        >
          <RefreshCw
            size={16}
            style={{
              marginRight: "calc(5px * var(--bsm-spacing-scale))",
            }}
            className={loading ? "spin" : ""}
          />{" "}
          Reload
        </button>
      </div>

      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Settings categories"
        onKeyDown={(event) => {
          const index = tabs.indexOf(activeTab);
          const next =
            event.key === "ArrowRight"
              ? (index + 1) % tabs.length
              : event.key === "ArrowLeft"
                ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            setSearchParams({ tab: tabs[next] });
            document.getElementById(`settings-tab-${tabs[next]}`)?.focus();
          }
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`settings-tab-${tab}`}
            aria-controls={`settings-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setSearchParams({ tab })}
          >
            {
              {
                general: "General",
                backups: "Backups",
                web: "Web & access",
                storage: "Storage",
                advanced: "Advanced",
              }[tab]
            }
          </button>
        ))}
      </div>
      {loadError && (
        <div className="message message-error" role="alert">
          {loadError}. Refresh before editing these settings.
        </div>
      )}
      {savedSnapshot !== null && JSON.stringify(settings) !== savedSnapshot && (
        <p className="save-state" role="status">
          Unsaved changes
        </p>
      )}
      {loading && Object.keys(settings).length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "calc(40px * var(--bsm-spacing-scale))",
          }}
        >
          <div className="spinner"></div> Loading settings…
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="settings-form"
          aria-busy={saving}
        >
          <fieldset
            disabled={loading || saving || !!loadError}
            className="form-fields"
          >
            <div
              role="tabpanel"
              id={`settings-panel-${activeTab}`}
              aria-labelledby={`settings-tab-${activeTab}`}
            >
              {activeTab === "backups" ? (
                settings.backups ? (
                  <BackupSettings
                    retention={settings.retention?.backups}
                    setRetention={(value) =>
                      handleChange("retention.backups", value)
                    }
                    policy={settings.backups}
                    setPolicy={(value) => handleChange("backups", value)}
                  />
                ) : (
                  <p>Backup settings are unavailable from this backend.</p>
                )
              ) : (
                <SettingsGroups
                  settings={Object.fromEntries(
                    Object.entries(
                      activeTab === "storage" && settings.retention
                        ? {
                            ...settings,
                            retention: Object.fromEntries(
                              Object.entries(settings.retention).filter(
                                ([key]) => key !== "backups",
                              ),
                            ),
                          }
                        : settings,
                    ).filter(
                      ([group]) =>
                        (tabGroups[activeTab] ?? []).includes(group) ||
                        (activeTab === "general" && !groupedKeys.has(group)),
                    ),
                  )}
                  onChange={handleChange}
                />
              )}
            </div>

            {/* Custom Settings Entry */}
            {activeTab === "advanced" && (
              <div
                className="settings-group"
                style={{
                  marginTop: "calc(20px * var(--bsm-spacing-scale))",
                }}
              >
                <h3 className="settings-group-title">Add Custom Setting</h3>
                <div
                  style={{
                    display: "flex",
                    gap: "calc(10px * var(--bsm-spacing-scale))",
                    alignItems: "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: "200px",
                    }}
                  >
                    <label className="form-label" htmlFor="bsmsettings-field-1">
                      Key Name (custom. prefix added automatically)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., my_setting"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      id="bsmsettings-field-1"
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: "200px",
                    }}
                  >
                    <label className="form-label" htmlFor="bsmsettings-field-2">
                      Value
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      id="bsmsettings-field-2"
                    />
                  </div>
                  <button
                    className="action-button secondary"
                    onClick={handleAddCustom}
                    disabled={!newKey.trim()}
                    style={{
                      marginBottom: "calc(2px * var(--bsm-spacing-scale))",
                    }}
                    type="button"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
            <div
              className="form-actions"
              style={{
                marginTop: "calc(20px * var(--bsm-spacing-scale))",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "calc(20px * var(--bsm-spacing-scale))",
              }}
            >
              <button
                type="submit"
                className="action-button"
                disabled={loading || saving || !!loadError || draft.conflicted}
              >
                <Save
                  size={16}
                  style={{
                    marginRight: "calc(5px * var(--bsm-spacing-scale))",
                  }}
                />{" "}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
};
export default BSMSettings;
