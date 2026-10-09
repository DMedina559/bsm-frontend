import { queryKeys } from "../app/queryKeys";
import { useEditableDraft } from "../app/useEditableDraft";
import QueryStatus from "../components/QueryStatus";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import SettingsField from "../components/SettingsField";
import {
  flattenSettings,
  updateSetting,
  isSafeSettingPath,
} from "../utils/settings";
import { useDialog } from "../DialogContext";
import React, { useEffect, useState } from "react";
import { CheckCircle, Download, RefreshCw, Save, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { post, del } from "../api";
const EMPTY_SETTINGS = {};
const ServerConfig = () => {
  const { confirmAction } = useDialog();
  const { selectedServer } = useServer();
  const resourceQuery = useResourceQuery("serverSettings", selectedServer);
  const draft = useEditableDraft(
    selectedServer,
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
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const setupFlow = location.state?.setupFlow;
  const write = useResourceMutation(
    async ({ method, url, body, options, entries }) => {
      if (entries) {
        for (const [key, value] of entries) await post(url, { key, value });
        return;
      }
      if (method === "post") return post(url, body);
      if (method === "del")
        return options === undefined ? del(url) : del(url, options);
    },
    [queryKeys.serverSettings(selectedServer), queryKeys.servers()],
  );
  const writePost = (url, body) =>
    write.mutateAsync({ url, body, method: "post" });
  const writeDelete = (url, options) =>
    write.mutateAsync({ url, options, method: "del" });
  useEffect(() => {
    setLoadError(resourceQuery.error?.message ?? null);
  }, [resourceQuery.error]);
  const handleRefresh = async () => {
    const success = await draft.refresh(async () => {
      const result = await resourceQuery.refetch();
      return { ...result, data: result.data };
    });
    if (success) {
      addToast("Settings refreshed", "success");
    }
  };
  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedServer) return;
    if (saving) return;
    setSaving(true);
    try {
      const flattened = flattenSettings(settings);
      await write.mutateAsync({
        url: `/api/server/${selectedServer}/settings/set`,
        entries: Object.entries(flattened).filter(
          ([key]) => key !== "config_schema_version",
        ),
      });
      markSaved(settings);
      addToast("Server settings saved successfully.", "success");
    } catch (error) {
      addToast(error.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };
  const handleFinishSetup = async () => {
    if (
      await confirmAction(
        "Setup complete! Would you like to start the server now?",
      )
    ) {
      addToast("Starting server...", "info");
      try {
        await writePost(`/api/server/${selectedServer}/start`);
        addToast("Server start signal sent.", "success");
      } catch (error) {
        addToast("Failed to start server: " + error.message, "error");
      }
    }
    navigate("/");
    addToast("Server setup complete!", "success");
  };
  const handleUpdateServer = async () => {
    if (!selectedServer) return;
    if (
      !(await confirmAction(
        "This will stop the server and update it to the latest version. Continue?",
      ))
    )
      return;
    addToast("Updating server...", "info");
    try {
      await writePost(`/api/server/${selectedServer}/update`, {});
      addToast("Update task started. Check logs.", "success");
    } catch (error) {
      addToast(error.message || "Failed to start update.", "error");
    }
  };
  const handleDeleteServer = async () => {
    if (!selectedServer) return;
    const confirmed = await confirmAction(
      `Are you sure you want to delete server "${selectedServer}"?\n\nThis action cannot be undone. All server data will be permanently lost.`,
    );
    if (!confirmed) return;
    setSaving(true);
    addToast(`Deleting server "${selectedServer}"...`, "info");
    try {
      await writeDelete(`/api/server/${selectedServer}/delete`);
      addToast(`Server "${selectedServer}" deletion started.`, "success");
      navigate("/");
    } catch (error) {
      addToast(error.message || "Failed to delete server.", "error");
      setSaving(false);
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
    handleChange(fullKey, newValue);
    setNewKey("");
    setNewValue("");
    addToast(`Added ${fullKey} to pending changes.`, "info");
  };
  const renderFields = (obj, prefix = "") => {
    return Object.entries(obj).map(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (key === "config_schema_version") return null;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return (
          <div
            key={fullPath}
            style={{
              marginBottom: "20px",
              marginLeft: "10px",
              paddingLeft: "10px",
              borderLeft: "2px solid var(--border-color)",
            }}
          >
            <h4
              style={{
                textTransform: "capitalize",
                margin: "10px 0",
              }}
            >
              {key.replace(/_/g, " ")}
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                gap: "15px",
              }}
            >
              {renderFields(value, fullPath)}
            </div>
          </div>
        );
      }
      return (
        <SettingsField
          key={`${selectedServer}:${fullPath}`}
          path={fullPath}
          value={value}
          onChange={handleChange}
          readOnly={
            prefix.includes("server_info") &&
            (key === "status" || key === "installed_version")
          }
        />
      );
    });
  };
  if (!selectedServer) {
    return (
      <div className="container">
        <div
          className="message-box message-warning"
          style={{
            textAlign: "center",
            marginTop: "50px",
            padding: "20px",
            border: "1px solid orange",
            color: "orange",
          }}
        >
          Please select a server to configure.
        </div>
      </div>
    );
  }
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
        <h1>Server Settings: {selectedServer}</h1>
        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          {!setupFlow && (
            <button
              className="action-button secondary"
              onClick={handleRefresh}
              disabled={loading || saving}
              type="button"
            >
              <RefreshCw
                size={16}
                style={{
                  marginRight: "5px",
                }}
              />{" "}
              Refresh
            </button>
          )}
          {setupFlow && (
            <button
              className="action-button success-button"
              onClick={handleFinishSetup}
              type="button"
            >
              <CheckCircle
                size={16}
                style={{
                  marginRight: "5px",
                }}
              />{" "}
              Finish Setup
            </button>
          )}
        </div>
      </div>

      {setupFlow && (
        <div
          className="message-box message-info"
          style={{
            marginBottom: "20px",
          }}
        >
          <strong>Setup Wizard (Step 5/5):</strong> Configure settings for this
          server.
        </div>
      )}

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
            padding: "20px",
          }}
        >
          Loading settings...
        </div>
      ) : (
        <div
          className="grid"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {!setupFlow && (
            <div
              style={{
                padding: "15px",
                background: "var(--border-color)",
                borderRadius: "5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  color: "var(--text-color)",
                }}
              >
                <strong>Quick Actions:</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                }}
              >
                <button
                  className="action-button"
                  onClick={handleUpdateServer}
                  type="button"
                >
                  <Download
                    size={16}
                    style={{
                      marginRight: "5px",
                    }}
                  />{" "}
                  Update Server
                </button>
                <button
                  className="action-button danger-button"
                  onClick={handleDeleteServer}
                  type="button"
                >
                  <Trash2
                    size={16}
                    style={{
                      marginRight: "5px",
                    }}
                  />{" "}
                  Delete Server
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="form-group" aria-busy={saving}>
            <fieldset
              disabled={loading || saving || !!loadError}
              className="form-fields"
            >
              <div
                style={{
                  background: "var(--container-background-color)",
                  padding: "20px",
                  border: "1px solid var(--border-color)",
                }}
              >
                {Object.entries(settings).map(([group, groupData]) => {
                  if (
                    typeof groupData === "object" &&
                    groupData !== null &&
                    !Array.isArray(groupData)
                  ) {
                    return (
                      <div
                        key={group}
                        style={{
                          marginBottom: "30px",
                          borderBottom: "1px solid var(--border-color)",
                          paddingBottom: "20px",
                        }}
                      >
                        <h3
                          style={{
                            textTransform: "capitalize",
                            margin: "0 0 15px 0",
                          }}
                        >
                          {group.replace(/_/g, " ")}
                        </h3>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: "10px",
                          }}
                        >
                          {renderFields(groupData, group)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Custom Settings Entry */}
              <div
                style={{
                  background: "var(--container-background-color)",
                  padding: "20px",
                  border: "1px solid var(--border-color)",
                  marginTop: "20px",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                  }}
                >
                  Add Custom Setting
                </h3>
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
                    <label
                      className="form-label"
                      htmlFor="serverconfig-field-1"
                    >
                      Key Name (custom. prefix added automatically)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., my_setting"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      id="serverconfig-field-1"
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: "200px",
                    }}
                  >
                    <label
                      className="form-label"
                      htmlFor="serverconfig-field-2"
                    >
                      Value
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      id="serverconfig-field-2"
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
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "20px",
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
                  Save Settings
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      )}
    </div>
  );
};
export default ServerConfig;
