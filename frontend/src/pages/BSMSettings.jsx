import { useRequestTracker } from "../utils/useRequestTracker";
import SettingsField from "../components/SettingsField";
import {
  flattenSettings,
  updateSetting,
  isSafeSettingPath,
} from "../utils/settings";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useToast } from "../ToastContext";
import { get, post, put } from "../api";
import { logger } from "../utils/logger";
const BSMSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const { addToast } = useToast();
  const beginRequest = useRequestTracker("" + ":" + "");
  const fetchSettings = useCallback(async () => {
    const requestTicket = beginRequest("fetchSettings");
    setLoading(true);
    setLoadError(null);
    try {
      const data = await get("/api/settings/get");
      if (!requestTicket.current()) return false;
      if (data && data.settings) {
        setSettings(data.settings);
        setSavedSnapshot(JSON.stringify(data.settings));
      } else {
        setLoadError("Failed to load settings");
        addToast("Failed to load settings", "error");
      }
    } catch (error) {
      if (!requestTicket.current()) return false;
      setLoadError(error.message || "Error fetching settings");
      addToast(error.message || "Error fetching settings", "error");
    } finally {
      if (requestTicket.current()) {
        setLoading(false);
      }
    }
  }, [addToast, beginRequest]);
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const flattened = flattenSettings(settings);

      // Iterate through keys and save each one individually as the API expects
      // POST /api/settings/set with body { key: "...", value: ... }
      for (const [key, value] of Object.entries(flattened)) {
        try {
          await post("/api/settings/set", {
            key: key,
            value: value,
          });
        } catch (err) {
          logger.error(`[BSMSettings] Failed to save setting`, {
            error: err,
            key,
            value,
          });
          throw err; // Re-throw to be caught by outer block
        }
      }
      setSavedSnapshot(JSON.stringify(settings));
      addToast("Settings saved successfully.", "success");
    } catch (error) {
      logger.error("[BSMSettings] Save settings error", {
        error,
      });
      addToast(error.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };
  const handleReload = async () => {
    setLoading(true);
    try {
      await put("/api/settings/reload");
      addToast("Settings reloaded from disk.", "success");
      fetchSettings();
    } catch (error) {
      addToast(error.message || "Failed to reload settings.", "error");
      setLoading(false);
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
