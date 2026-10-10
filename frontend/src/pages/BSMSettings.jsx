import { callOperation } from "../api/operations";
import { useEditableDraft } from "../app/useEditableDraft";
import QueryStatus from "../components/QueryStatus";
import { queryKeys } from "../app/queryKeys";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import SettingsField from "../components/SettingsField";
import {
  flattenSettings,
  updateSetting,
  isSafeSettingPath,
} from "../utils/settings";
import React, { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useToast } from "../ToastContext";

import { logger } from "../utils/logger";
const EMPTY_SETTINGS = {};
const BSMSettings = () => {
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
    [queryKeys.settings()],
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
    if (saving) return;

    try {
      const flattened = flattenSettings(settings);

      // Iterate through keys and save each one individually as the API expects
      await write.mutateAsync({
        entries: Object.entries(flattened),
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
  const renderField = (key, value, fullPath) => (
    <SettingsField
      key={fullPath}
      path={fullPath}
      label={key.replace(/_/g, " ")}
      value={value}
      onChange={handleChange}
    />
  );
  const renderGroup = (groupName, data, prefix = "") => {
    return (
      <div
        key={prefix ? `${prefix}.${groupName}` : groupName}
        className="settings-group"
      >
        <h3 className="settings-group-title">{groupName.replace(/_/g, " ")}</h3>
        <div className="settings-grid">
          {Object.entries(data).map(([key, value]) => {
            const currentPath = prefix
              ? `${prefix}.${groupName}.${key}`
              : `${groupName}.${key}`;
            // Check if value is nested object (and not array)
            if (
              typeof value === "object" &&
              value !== null &&
              !Array.isArray(value)
            ) {
              return renderGroup(
                key,
                value,
                prefix ? `${prefix}.${groupName}` : groupName,
              );
            }
            return renderField(key, value, currentPath);
          })}
        </div>
      </div>
    );
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
              marginRight: "5px",
            }}
            className={loading ? "spin" : ""}
          />{" "}
          Reload
        </button>
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
            padding: "40px",
          }}
        >
          <div className="spinner"></div> Loading settings...
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
            <div className="settings-container">
              {Object.entries(settings).map(([group, groupData]) => {
                if (
                  typeof groupData === "object" &&
                  groupData !== null &&
                  !Array.isArray(groupData)
                ) {
                  return renderGroup(group, groupData);
                }
                return renderField(group, groupData, group);
              })}
            </div>

            {/* Custom Settings Entry */}
            <div
              className="settings-group"
              style={{
                marginTop: "20px",
              }}
            >
              <h3 className="settings-group-title">Add Custom Setting</h3>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
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
                    marginBottom: "2px",
                  }}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>

            <div
              className="form-actions"
              style={{
                marginTop: "20px",
                borderTop: "1px solid var(--border-color)",
                paddingTop: "20px",
              }}
            >
              <button
                type="submit"
                className="action-button"
                disabled={loading || saving || !!loadError}
              >
                <Save
                  size={16}
                  style={{
                    marginRight: "5px",
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
