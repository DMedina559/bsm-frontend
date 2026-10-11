import DraftConflictNotice from "../components/DraftConflictNotice";
import { callOperation } from "../api/operations";
import { queryKeys } from "../app/queryKeys";
import QueryStatus from "../components/QueryStatus";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import { useEditableDraft } from "../app/useEditableDraft";
import Modal from "../components/Modal";
import { useDialog } from "../contexts/DialogContext";
import React, { useState } from "react";
import { useServer } from "../contexts/ServerContext";
import { useToast } from "../contexts/ToastContext";
import { request, resolveApiUrl } from "../api/transport";
import { resolveOperationUrl } from "../api/operations";

import {
  Upload,
  Trash2,
  Folder,
  RefreshCw,
  Layers,
  RefreshCcw,
  Download,
  Settings,
  X,
} from "lucide-react";
import DraggableList from "../components/DraggableList";
const EMPTY_ADDONS = { behavior_packs: [], resource_packs: [] };
const Content = () => {
  const { confirmAction } = useDialog();
  const { selectedServer } = useServer();
  const [activeTab, setActiveTab] = useState("worlds");
  const contentQuery = useResourceQuery(
    "content",
    activeTab === "worlds" ? "worlds" : "addons",
    { enabled: Boolean(selectedServer) },
  );
  const items = (contentQuery.data ?? []).map((item) => ({
    ...item,
    type: activeTab,
  }));
  const loading = contentQuery.isFetching;
  const pluginQuery = useResourceQuery("plugins");
  const isUploadEnabled = Boolean(
    pluginQuery.data?.find(
      (plugin) => plugin.name === "content_uploader_plugin",
    )?.enabled,
  );
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [addonModalTab, setAddonModalTab] = useState("behavior");
  const addonsQuery = useResourceQuery("installedAddons", selectedServer, {
    enabled: isAddonModalOpen,
  });
  const addonDraft = useEditableDraft(
    selectedServer,
    addonsQuery.data,
    EMPTY_ADDONS,
  );
  const {
    value: installedAddons,
    setValue: setInstalledAddons,
    dirty: orderChanged,
  } = addonDraft;
  const addonsLoading = addonsQuery.isFetching;
  const { addToast } = useToast();
  const write = useResourceMutation(
    ({ id, options }, { session }) =>
      callOperation(id, { ...options, session }),
    [
      queryKeys.content(),
      queryKeys.servers(),
      queryKeys.serverAddons(selectedServer),
    ],
  );
  /** @type {typeof callOperation} */
  const writeOperation = (id, ...args) =>
    write.mutateAsync({ id, options: args[0] });

  const upload = useResourceMutation(
    (body, { session }) =>
      request("/api/content/upload", { method: "POST", body, session }),
    [queryKeys.content()],
  );
  const actionLoading = write.isPending || upload.isPending;

  const fetchItems = async () => {
    const result = await contentQuery.refetch();
    if (result.error) addToast(result.error.message, "error");
    return result.isSuccess;
  };
  const handleRefresh = async () => {
    const success = await fetchItems();
    if (success) {
      addToast(
        `${activeTab === "worlds" ? "Worlds" : "Addons"} list refreshed`,
        "success",
      );
    }
  };
  const handleInstall = async (item) => {
    if (
      !(await confirmAction(
        `Install ${item.name} to server ${selectedServer}? Server will restart.`,
      ))
    )
      return;

    try {
      await writeOperation(
        activeTab === "worlds" ? "install_world" : "install_addon",
        {
          path: { server_name: selectedServer },
          body: { filename: item.name },
        },
      );
      addToast(`Installation of ${item.name} started.`, "success");
    } catch (error) {
      addToast(error.message || "Installation failed.", "error");
    }
  };
  const handleResetWorld = async () => {
    if (
      !(await confirmAction(
        `Are you sure you want to RESET the world for ${selectedServer}? This will DELETE the current active world directory. This cannot be undone!`,
      ))
    )
      return;

    try {
      await writeOperation("reset_world", {
        path: { server_name: selectedServer },
      });
      addToast(`World reset initiated for ${selectedServer}.`, "success");
    } catch (error) {
      addToast(error.message || "World reset failed.", "error");
    }
  };
  const handleExportWorld = async () => {
    try {
      await writeOperation("export_world", {
        path: { server_name: selectedServer },
      });
      addToast(`World export initiated for ${selectedServer}.`, "success");
      // Optionally refresh list after a delay, but it's async background task
    } catch (error) {
      addToast(error.message || "World export failed.", "error");
    }
  };
  const handleOpenAddonModal = () => {
    setIsAddonModalOpen(true);
  };
  const handleCloseAddonModal = async () => {
    if (orderChanged && !(await confirmAction("Discard unsaved addon order?")))
      return;
    setIsAddonModalOpen(false);
  };
  const handleReorderAddons = (newItems, type) => {
    setInstalledAddons((prev) => ({
      ...prev,
      [type === "behavior" ? "behavior_packs" : "resource_packs"]: newItems,
    }));
  };
  const handleSaveAddonOrder = async () => {
    if (!selectedServer) return;

    try {
      if (addonModalTab === "behavior") {
        // Save behavior packs order
        const behaviorUuids = installedAddons.behavior_packs
          .filter((p) => p.status === "ACTIVE" && p.uuid)
          .map((p) => p.uuid);
        if (behaviorUuids.length > 0) {
          await writeOperation("reorder_addons", {
            path: { server_name: selectedServer },
            body: {
              pack_type: "behavior",
              uuids: behaviorUuids,
            },
          });
        }
      } else if (addonModalTab === "resource") {
        // Save resource packs order
        const resourceUuids = installedAddons.resource_packs
          .filter((p) => p.status === "ACTIVE" && p.uuid)
          .map((p) => p.uuid);
        if (resourceUuids.length > 0) {
          await writeOperation("reorder_addons", {
            path: { server_name: selectedServer },
            body: {
              pack_type: "resource",
              uuids: resourceUuids,
            },
          });
        }
      }
      addToast("Addon order saved.", "success");
      addonDraft.markSaved(installedAddons);
    } catch (error) {
      addToast(error.message || "Failed to save order", "error");
    }
  };
  /** @param {{uuid: string}} pack @param {"behavior" | "resource"} packType @param {"enable" | "disable" | "uninstall"} action */
  const handleAddonAction = async (pack, packType, action) => {
    if (
      action === "uninstall" &&
      !(await confirmAction(`Are you sure you want to uninstall ${pack.name}?`))
    )
      return;

    try {
      if (action === "uninstall") {
        await writeOperation("uninstall_addon", {
          path: { server_name: selectedServer },
          body: {
            pack_uuid: pack.uuid,
            pack_type: packType,
          },
        });
      } else {
        await writeOperation(
          /** @type {const} */ ({
            enable: "enable_addon",
            disable: "disable_addon",
          })[action],
          {
            path: { server_name: selectedServer },
            body: {
              pack_uuid: pack.uuid,
              pack_type: packType,
            },
          },
        );
      }
      addToast(`${action} successful.`, "success");
    } catch (error) {
      addToast(error.message || `Failed to ${action} addon`, "error");
    }
  };
  const handleSubpackChange = async (pack, packType, newSubpackFolderName) => {
    try {
      await writeOperation("update_addon_subpack", {
        path: { server_name: selectedServer },
        body: {
          pack_uuid: pack.uuid,
          pack_type: packType,
          subpack_name: newSubpackFolderName,
        },
      });
      addToast("Subpack updated.", "success");

      // Update local state immediately so dropdown shows the new value without waiting for slow fetch
      setInstalledAddons((prev) => {
        const listKey =
          packType === "behavior" ? "behavior_packs" : "resource_packs";
        return {
          ...prev,
          [listKey]: prev[listKey].map((p) =>
            p.uuid === pack.uuid
              ? {
                  ...p,
                  active_subpack: newSubpackFolderName,
                }
              : p,
          ),
        };
      });
    } catch (error) {
      addToast(error.message || "Failed to update subpack", "error");
    }
  };
  const renderAddonItem = (item, packType) => {
    const isActive = item.status === "ACTIVE";
    const statusColor = isActive
      ? "var(--bsm-success)"
      : "var(--text-color-secondary)";
    const versionStr = Array.isArray(item.version)
      ? item.version.join(".")
      : "Unknown";
    const subpacks = item.subpacks || [];
    const hasSubpacks = subpacks.length > 0;

    // Sometimes active_subpack might be null or undefined. Default to first subpack folder name.
    // Also, handle case where active_subpack doesn't match any folder_name.
    let activeSubpack = item.active_subpack;
    if (
      !activeSubpack ||
      !subpacks.find((sp) => sp.folder_name === activeSubpack)
    ) {
      activeSubpack = hasSubpacks ? subpacks[0].folder_name : "";
    }
    return (
      <div
        className="server-card"
        style={{
          width: "100%",
          height: "115px",
          background: "var(--container-background-color)",
          border: "1px solid var(--border-color)",
          borderRadius: "4px",
          display: "flex",
          alignItems: "stretch",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "calc(10px * var(--bsm-spacing-scale))",
            alignItems: "center",
            gap: "calc(10px * var(--bsm-spacing-scale))",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {item.icon ? (
            <img
              src={resolveApiUrl(
                resolveOperationUrl("get_server_addon_icon", {
                  path: { server_name: selectedServer },
                  query: { pack_type: packType, uuid: item.uuid },
                }),
              )}
              alt={`${item.name} icon`}
              style={{
                width: "48px",
                height: "48px",
                objectFit: "cover",
                borderRadius: "4px",
                flexShrink: 0,
              }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div
              style={{
                width: "48px",
                height: "48px",
                background: "var(--bsm-surface-raised)",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Layers size={24} color="var(--text-color-secondary)" />
            </div>
          )}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "center",
              gap: "calc(6px * var(--bsm-spacing-scale))",
            }}
          >
            <h4
              style={{
                margin: "0",
                overflowY: "auto",
                wordWrap: "break-word",
                maxHeight: "45px",
                lineHeight: "1.2",
              }}
            >
              {item.name || "Unknown Pack"}
            </h4>

            <div
              style={{
                fontSize: "0.85em",
                color: "var(--text-color-secondary)",
                display: "flex",
                flexWrap: "wrap",
                gap: "calc(10px * var(--bsm-spacing-scale))",
                alignItems: "center",
              }}
            >
              <span>v{versionStr}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "calc(4px * var(--bsm-spacing-scale))",
                  color: statusColor,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: statusColor,
                  }}
                ></span>
                {item.status || "UNKNOWN"}
              </span>
            </div>

            {isActive && hasSubpacks && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "calc(6px * var(--bsm-spacing-scale))",
                  marginTop: "auto",
                }}
              >
                <select
                  className="form-input"
                  style={{
                    flex: 1,
                    padding:
                      "calc(2px * var(--bsm-spacing-scale)) calc(6px * var(--bsm-spacing-scale))",
                    fontSize: "0.8em",
                    height: "24px",
                    maxWidth: "200px",
                  }}
                  value={activeSubpack}
                  onChange={(e) =>
                    handleSubpackChange(item, packType, e.target.value)
                  }
                  disabled={actionLoading}
                  title="Active Subpack"
                >
                  {subpacks.map((sp) => (
                    <option key={sp.folder_name} value={sp.folder_name}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "calc(10px * var(--bsm-spacing-scale))",
            background: "rgba(0,0,0,0.1)",
            borderLeft: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            gap: "calc(8px * var(--bsm-spacing-scale))",
            justifyContent: "center",
            width: "90px",
            flexShrink: 0,
          }}
        >
          {isActive ? (
            <button
              className="action-button warning-button"
              style={{
                padding:
                  "calc(6px * var(--bsm-spacing-scale)) calc(8px * var(--bsm-spacing-scale))",
                fontSize: "0.85em",
                width: "100%",
                justifyContent: "center",
              }}
              onClick={() => handleAddonAction(item, packType, "disable")}
              disabled={actionLoading}
              type="button"
            >
              Disable
            </button>
          ) : (
            <button
              className="action-button success-button"
              style={{
                padding:
                  "calc(6px * var(--bsm-spacing-scale)) calc(8px * var(--bsm-spacing-scale))",
                fontSize: "0.85em",
                background: "var(--bsm-success)",
                color: "var(--text-color)",
                width: "100%",
                justifyContent: "center",
              }}
              onClick={() => handleAddonAction(item, packType, "enable")}
              disabled={actionLoading}
              type="button"
            >
              Enable
            </button>
          )}
          <button
            className="action-button danger-button"
            style={{
              padding:
                "calc(6px * var(--bsm-spacing-scale)) calc(8px * var(--bsm-spacing-scale))",
              fontSize: "0.85em",
              width: "100%",
              justifyContent: "center",
            }}
            onClick={() => handleAddonAction(item, packType, "uninstall")}
            disabled={actionLoading}
            type="button"
          >
            Uninstall
          </button>
        </div>
      </div>
    );
  };
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    // Determine type based on tab or file extension
    const type = activeTab === "worlds" ? "world" : "addon";
    formData.append("type", type);
    try {
      const data = await upload.mutateAsync(formData);
      if (data && data.status === "success") {
        addToast("Upload successful.", "success");
      } else {
        addToast(`Upload failed: ${data?.message || "Unknown error"}`, "error");
      }
    } catch {
      addToast("Upload failed.", "error");
    } finally {
      e.target.value = null; // Reset input
    }
  };
  if (!selectedServer) {
    return (
      <div className="container">
        <div
          className="message-box message-warning"
          style={{
            textAlign: "center",
            marginTop: "calc(50px * var(--bsm-spacing-scale))",
            padding: "calc(20px * var(--bsm-spacing-scale))",
            border: "1px solid orange",
            color: "orange",
          }}
        >
          Please select a server.
        </div>
      </div>
    );
  }
  return (
    <div className="container">
      <DraftConflictNotice draft={addonDraft} />
      <QueryStatus query={contentQuery} />
      <div
        className="header"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "calc(10px * var(--bsm-spacing-scale))",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
          }}
        >
          Content Management: {selectedServer}
        </h1>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "calc(10px * var(--bsm-spacing-scale))",
          }}
        >
          <button
            className="action-button secondary"
            onClick={handleRefresh}
            disabled={loading || actionLoading}
            type="button"
          >
            <RefreshCw
              size={16}
              style={{
                marginRight: "calc(5px * var(--bsm-spacing-scale))",
              }}
              className={loading ? "spin" : ""}
            />{" "}
            Refresh
          </button>
          {activeTab === "addons" && (
            <button
              className="action-button primary"
              onClick={handleOpenAddonModal}
              disabled={actionLoading}
              type="button"
            >
              <Settings
                size={16}
                style={{
                  marginRight: "calc(5px * var(--bsm-spacing-scale))",
                }}
              />{" "}
              Manage Installed Addons
            </button>
          )}
          {activeTab === "worlds" && (
            <>
              <button
                className="action-button secondary"
                onClick={handleExportWorld}
                disabled={actionLoading}
                title="Export active world to content/worlds"
                type="button"
              >
                <Download
                  size={16}
                  style={{
                    marginRight: "calc(5px * var(--bsm-spacing-scale))",
                  }}
                />{" "}
                Export World
              </button>
              <button
                className="action-button danger-button"
                onClick={handleResetWorld}
                disabled={actionLoading}
                title="Delete current world and generate new one"
                type="button"
              >
                <RefreshCcw
                  size={16}
                  style={{
                    marginRight: "calc(5px * var(--bsm-spacing-scale))",
                  }}
                />{" "}
                Reset World
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "worlds" ? "active" : ""}`}
          onClick={() => setActiveTab("worlds")}
          type="button"
          aria-pressed={activeTab === "worlds"}
        >
          Worlds
        </button>
        <button
          className={`tab-button ${activeTab === "addons" ? "active" : ""}`}
          onClick={() => setActiveTab("addons")}
          type="button"
          aria-pressed={activeTab === "addons"}
        >
          Addons
        </button>
      </div>

      {/* Manage Addons Modal */}
      {isAddonModalOpen && (
        <Modal
          title={<>Manage Installed Addons: {selectedServer}</>}
          onClose={handleCloseAddonModal}
          closeDisabled={actionLoading}
          className="addon-dialog"
        >
          <QueryStatus query={addonsQuery} />
          <div
            className="dynamic-modal-header"
            style={{
              padding: "calc(15px * var(--bsm-spacing-scale))",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          ></div>

          <div
            style={{
              padding: "0 calc(15px * var(--bsm-spacing-scale))",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              gap: "calc(10px * var(--bsm-spacing-scale))",
              marginTop: "calc(10px * var(--bsm-spacing-scale))",
            }}
          >
            <button
              className={`tab-button ${addonModalTab === "behavior" ? "active" : ""}`}
              onClick={() => setAddonModalTab("behavior")}
              style={{
                padding: "calc(10px * var(--bsm-spacing-scale))",
                background: "none",
                border: "none",
                borderBottom:
                  addonModalTab === "behavior"
                    ? "2px solid var(--primary-color)"
                    : "2px solid transparent",
                cursor: "pointer",
                color:
                  addonModalTab === "behavior"
                    ? "var(--primary-color)"
                    : "var(--text-color)",
                fontWeight: addonModalTab === "behavior" ? "bold" : "normal",
              }}
              type="button"
              aria-pressed={addonModalTab === "behavior"}
            >
              Behavior Packs
            </button>
            <button
              className={`tab-button ${addonModalTab === "resource" ? "active" : ""}`}
              onClick={() => setAddonModalTab("resource")}
              style={{
                padding: "calc(10px * var(--bsm-spacing-scale))",
                background: "none",
                border: "none",
                borderBottom:
                  addonModalTab === "resource"
                    ? "2px solid var(--primary-color)"
                    : "2px solid transparent",
                cursor: "pointer",
                color:
                  addonModalTab === "resource"
                    ? "var(--primary-color)"
                    : "var(--text-color)",
                fontWeight: addonModalTab === "resource" ? "bold" : "normal",
              }}
              type="button"
              aria-pressed={addonModalTab === "resource"}
            >
              Resource Packs
            </button>
          </div>

          <div
            className="dynamic-modal-body"
            style={{
              padding: "calc(15px * var(--bsm-spacing-scale))",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {addonsLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "calc(20px * var(--bsm-spacing-scale))",
                  color: "var(--text-color-secondary)",
                }}
              >
                Loading addons...
              </div>
            ) : (
              <>
                {addonModalTab === "behavior" &&
                  (installedAddons.behavior_packs.length > 0 ? (
                    <DraggableList
                      items={installedAddons.behavior_packs}
                      onReorder={(items) =>
                        handleReorderAddons(items, "behavior")
                      }
                      renderItem={(item) => renderAddonItem(item, "behavior")}
                    />
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "calc(20px * var(--bsm-spacing-scale))",
                        color: "var(--text-color-secondary)",
                      }}
                    >
                      No behavior packs installed.
                    </div>
                  ))}
                {addonModalTab === "resource" &&
                  (installedAddons.resource_packs.length > 0 ? (
                    <DraggableList
                      items={installedAddons.resource_packs}
                      onReorder={(items) =>
                        handleReorderAddons(items, "resource")
                      }
                      renderItem={(item) => renderAddonItem(item, "resource")}
                    />
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "calc(20px * var(--bsm-spacing-scale))",
                        color: "var(--text-color-secondary)",
                      }}
                    >
                      No resource packs installed.
                    </div>
                  ))}
              </>
            )}
          </div>

          <div
            style={{
              padding: "calc(15px * var(--bsm-spacing-scale))",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "calc(10px * var(--bsm-spacing-scale))",
            }}
          >
            <button
              className="action-button secondary"
              onClick={handleCloseAddonModal}
              type="button"
            >
              Close
            </button>
            <button
              className="action-button primary"
              onClick={handleSaveAddonOrder}
              disabled={!orderChanged || actionLoading}
              type="button"
            >
              Save Order
            </button>
          </div>
        </Modal>
      )}

      <div className="tab-content">
        {isUploadEnabled && (
          <div
            style={{
              marginBottom: "calc(20px * var(--bsm-spacing-scale))",
              padding: "calc(15px * var(--bsm-spacing-scale))",
              background: "var(--input-background-color)",
              borderRadius: "5px",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
              }}
            >
              Upload{" "}
              {activeTab === "worlds"
                ? "World (.mcworld)"
                : "Addon (.mcpack, .mcaddon)"}
            </h3>
            <input
              type="file"
              aria-label="Upload world or addon"
              onChange={handleUpload}
              disabled={loading || actionLoading}
              className="form-input"
            />
            <p
              style={{
                fontSize: "0.85em",
                color: "var(--text-color-secondary)",
                marginTop: "calc(5px * var(--bsm-spacing-scale))",
              }}
            >
              Uploaded files will appear in the list below.
            </p>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div
            style={{
              padding: "calc(40px * var(--bsm-spacing-scale))",
              textAlign: "center",
              color: "var(--text-color-secondary)",
            }}
          >
            <div className="spinner"></div> Loading available content...
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table
              className="server-table"
              style={{
                width: "100%",
              }}
            >
              <thead>
                <tr>
                  <th>File Name</th>
                  <th
                    style={{
                      width: "150px",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items && items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          maxWidth: "200px",
                          overflowX: "auto",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "calc(10px * var(--bsm-spacing-scale))",
                          }}
                        >
                          {activeTab === "worlds" ? (
                            <Folder
                              size={16}
                              style={{
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <Layers
                              size={16}
                              style={{
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="action-button"
                          onClick={() => handleInstall(item)}
                          title={`Install to ${selectedServer}`}
                          style={{
                            padding:
                              "calc(5px * var(--bsm-spacing-scale)) calc(10px * var(--bsm-spacing-scale))",
                            fontSize: "0.9em",
                          }}
                          disabled={actionLoading}
                          type="button"
                        >
                          Install
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="no-servers-row">
                    <td
                      colSpan="3"
                      className="no-servers"
                      style={{
                        textAlign: "center",
                        color: "var(--text-color-secondary)",
                        fontStyle: "italic",
                        padding: "calc(20px * var(--bsm-spacing-scale))",
                      }}
                    >
                      No available {activeTab} found in imports directory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default Content;
