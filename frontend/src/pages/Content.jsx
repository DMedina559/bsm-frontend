import React, { useState, useEffect } from "react";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { getApiBaseUrl } from "../api";
import { get, post, del, request } from "../api";
import { logger } from "../utils/logger";
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

const Content = () => {
  const { selectedServer } = useServer();
  const [activeTab, setActiveTab] = useState("worlds");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isUploadEnabled, setIsUploadEnabled] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [addonModalTab, setAddonModalTab] = useState("behavior");
  const [installedAddons, setInstalledAddons] = useState({
    behavior_packs: [],
    resource_packs: [],
  });
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const { addToast } = useToast();

  const checkUploadPluginStatus = async () => {
    try {
      const response = await get("/api/plugins");
      if (response && response.status === "success" && response.data) {
        const plugin = response.data["content_uploader_plugin"];
        if (plugin && plugin.enabled) {
          setIsUploadEnabled(true);
        } else {
          setIsUploadEnabled(false);
        }
      }
    } catch (error) {
      logger.warn("Failed to check upload plugin status:", error);
      setIsUploadEnabled(false);
    }
  };

  const fetchItems = React.useCallback(async () => {
    if (!selectedServer) return false;
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "worlds") {
        endpoint = `/api/content/worlds`;
      } else {
        endpoint = `/api/content/addons`;
      }

      const data = await get(endpoint);
      if (data && data.status === "success") {
        // Backend returns "files": ["filename.mcworld", ...]
        // We need to map this to objects for the table
        const fileList = data.files || [];
        const mappedItems = fileList.map((filename) => ({
          name: filename,
          type: activeTab,
        }));
        setItems(mappedItems);
        return true;
      } else {
        addToast(
          `Failed to load ${activeTab}: ${data.message || "Unknown error"}`,
          "error",
        );
        setItems([]);
        return false;
      }
    } catch (error) {
      logger.error(`Error fetching ${activeTab}:`, error);
      addToast(`Error fetching ${activeTab}`, "error");
      setItems([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedServer, activeTab, addToast]);

  useEffect(() => {
    checkUploadPluginStatus();
    if (selectedServer) {
      fetchItems();
    }
  }, [selectedServer, activeTab, fetchItems]);

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
      !confirm(
        `Install ${item.name} to server ${selectedServer}? Server will restart.`,
      )
    )
      return;

    setActionLoading(true);
    try {
      const endpoint =
        activeTab === "worlds"
          ? `/api/server/${selectedServer}/world/install`
          : `/api/server/${selectedServer}/addon/install`;

      await post(endpoint, { filename: item.name });
      addToast(`Installation of ${item.name} started.`, "success");
    } catch (error) {
      addToast(error.message || "Installation failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetWorld = async () => {
    if (
      !confirm(
        `Are you sure you want to RESET the world for ${selectedServer}? This will DELETE the current active world directory. This cannot be undone!`,
      )
    )
      return;

    setActionLoading(true);
    try {
      await del(`/api/server/${selectedServer}/world/reset`);
      addToast(`World reset initiated for ${selectedServer}.`, "success");
    } catch (error) {
      addToast(error.message || "World reset failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportWorld = async () => {
    setActionLoading(true);
    try {
      await post(`/api/server/${selectedServer}/world/export`);
      addToast(`World export initiated for ${selectedServer}.`, "success");
      // Optionally refresh list after a delay, but it's async background task
    } catch (error) {
      addToast(error.message || "World export failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchInstalledAddons = async () => {
    if (!selectedServer) return;
    setAddonsLoading(true);
    setOrderChanged(false);
    try {
      const data = await get(`/api/server/${selectedServer}/addons`);
      if (data && data.status === "success" && data.addons) {
        const bp = (data.addons.behavior_packs || []).map((p) => ({
          ...p,
          id: p.uuid,
        }));
        const rp = (data.addons.resource_packs || []).map((p) => ({
          ...p,
          id: p.uuid,
        }));
        setInstalledAddons({ behavior_packs: bp, resource_packs: rp });
      } else {
        addToast("Failed to load installed addons", "error");
        setInstalledAddons({ behavior_packs: [], resource_packs: [] });
      }
    } catch (error) {
      logger.error("Error fetching installed addons:", error);
      addToast("Error fetching installed addons", "error");
      setInstalledAddons({ behavior_packs: [], resource_packs: [] });
    } finally {
      setAddonsLoading(false);
    }
  };

  const handleOpenAddonModal = () => {
    setIsAddonModalOpen(true);
    fetchInstalledAddons();
  };

  const handleCloseAddonModal = () => {
    setIsAddonModalOpen(false);
  };

  const handleReorderAddons = (newItems, type) => {
    setInstalledAddons((prev) => ({
      ...prev,
      [type === "behavior" ? "behavior_packs" : "resource_packs"]: newItems,
    }));
    setOrderChanged(true);
  };

  const handleSaveAddonOrder = async () => {
    if (!selectedServer) return;
    setActionLoading(true);
    try {
      if (addonModalTab === "behavior") {
        // Save behavior packs order
        const behaviorUuids = installedAddons.behavior_packs
          .filter((p) => p.status === "ACTIVE" && p.uuid)
          .map((p) => p.uuid);

        if (behaviorUuids.length > 0) {
          await post(`/api/server/${selectedServer}/addon/reorder`, {
            pack_type: "behavior",
            uuids: behaviorUuids,
          });
        }
      } else if (addonModalTab === "resource") {
        // Save resource packs order
        const resourceUuids = installedAddons.resource_packs
          .filter((p) => p.status === "ACTIVE" && p.uuid)
          .map((p) => p.uuid);

        if (resourceUuids.length > 0) {
          await post(`/api/server/${selectedServer}/addon/reorder`, {
            pack_type: "resource",
            uuids: resourceUuids,
          });
        }
      }

      addToast("Addon order saved.", "success");
      setOrderChanged(false);
      fetchInstalledAddons();
    } catch (error) {
      addToast(error.message || "Failed to save order", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddonAction = async (pack, packType, action) => {
    if (
      action === "uninstall" &&
      !confirm(`Are you sure you want to uninstall ${pack.name}?`)
    )
      return;

    setActionLoading(true);
    try {
      await post(`/api/server/${selectedServer}/addon/${action}`, {
        pack_uuid: pack.uuid,
        pack_type: packType,
      });
      addToast(`${action} successful.`, "success");
      fetchInstalledAddons();
    } catch (error) {
      addToast(error.message || `Failed to ${action} addon`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubpackChange = async (pack, packType, newSubpackFolderName) => {
    setActionLoading(true);
    try {
      // The old UI used dynamic form state with names like `subpack_${uuid}`
      await post(`/api/server/${selectedServer}/addon/subpack`, {
        pack_uuid: pack.uuid,
        pack_type: packType,
        [`subpack_${pack.uuid}`]: newSubpackFolderName,
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
              ? { ...p, active_subpack: newSubpackFolderName }
              : p,
          ),
        };
      });
    } catch (error) {
      addToast(error.message || "Failed to update subpack", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const renderAddonItem = (item, packType) => {
    const isActive = item.status === "ACTIVE";
    const statusColor = isActive ? "#4CAF50" : "#777";
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
          background: "var(--container-background-color)",
          border: "1px solid var(--border-color)",
          borderRadius: "4px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "10px",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {item.icon ? (
            <img
              src={`${getApiBaseUrl()}/api/server/${selectedServer}/addon/icon?pack_type=${packType}&uuid=${item.uuid}`}
              alt={`${item.name} icon`}
              style={{
                width: "48px",
                height: "48px",
                objectFit: "cover",
                borderRadius: "4px",
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
                background: "#333",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={24} color="#666" />
            </div>
          )}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <h4
              style={{
                margin: "0 0 4px 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.name || "Unknown Pack"}
            </h4>
            <div
              style={{
                fontSize: "0.85em",
                color: "#ccc",
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <span>v{versionStr}</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
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
          </div>
        </div>

        {isActive && hasSubpacks && (
          <div
            style={{
              padding: "8px 10px",
              background: "var(--input-background-color)",
              borderTop: "1px solid var(--border-color)",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <label
              style={{
                fontSize: "0.85em",
                color: "var(--text-color-secondary)",
                flexShrink: 0,
              }}
            >
              Active Subpack:
            </label>
            <select
              className="form-input"
              style={{ flex: 1, padding: "4px 8px", fontSize: "0.85em" }}
              value={activeSubpack}
              onChange={(e) =>
                handleSubpackChange(item, packType, e.target.value)
              }
              disabled={actionLoading}
            >
              {subpacks.map((sp) => (
                <option key={sp.folder_name} value={sp.folder_name}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          style={{
            padding: "8px 10px",
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          {isActive ? (
            <button
              className="action-button warning-button"
              style={{ padding: "4px 8px", fontSize: "0.85em" }}
              onClick={() => handleAddonAction(item, packType, "disable")}
              disabled={actionLoading}
            >
              Disable
            </button>
          ) : (
            <button
              className="action-button success-button"
              style={{
                padding: "4px 8px",
                fontSize: "0.85em",
                background: "#4CAF50",
                color: "#fff",
              }}
              onClick={() => handleAddonAction(item, packType, "enable")}
              disabled={actionLoading}
            >
              Enable
            </button>
          )}
          <button
            className="action-button danger-button"
            style={{ padding: "4px 8px", fontSize: "0.85em" }}
            onClick={() => handleAddonAction(item, packType, "uninstall")}
            disabled={actionLoading}
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
      setLoading(true);

      const data = await request(`/api/content/upload`, {
        method: "POST",
        body: formData,
      });

      if (data && data.status === "success") {
        addToast("Upload successful.", "success");
        fetchItems();
      } else {
        addToast(`Upload failed: ${data.message || "Unknown error"}`, "error");
      }
    } catch {
      addToast("Upload failed.", "error");
    } finally {
      setLoading(false);
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
            marginTop: "50px",
            padding: "20px",
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
      <div
        className="header"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0 }}>Content Management: {selectedServer}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <button
            className="action-button secondary"
            onClick={handleRefresh}
            disabled={loading || actionLoading}
          >
            <RefreshCw
              size={16}
              style={{ marginRight: "5px" }}
              className={loading ? "spin" : ""}
            />{" "}
            Refresh
          </button>
          {activeTab === "addons" && (
            <button
              className="action-button primary"
              onClick={handleOpenAddonModal}
              disabled={actionLoading}
            >
              <Settings size={16} style={{ marginRight: "5px" }} /> Manage
              Installed Addons
            </button>
          )}
          {activeTab === "worlds" && (
            <>
              <button
                className="action-button secondary"
                onClick={handleExportWorld}
                disabled={actionLoading}
                title="Export active world to content/worlds"
              >
                <Download size={16} style={{ marginRight: "5px" }} /> Export
                World
              </button>
              <button
                className="action-button danger-button"
                onClick={handleResetWorld}
                disabled={actionLoading}
                title="Delete current world and generate new one"
              >
                <RefreshCcw size={16} style={{ marginRight: "5px" }} /> Reset
                World
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "worlds" ? "active" : ""}`}
          onClick={() => setActiveTab("worlds")}
        >
          Worlds
        </button>
        <button
          className={`tab-button ${activeTab === "addons" ? "active" : ""}`}
          onClick={() => setActiveTab("addons")}
        >
          Addons
        </button>
      </div>

      {/* Manage Addons Modal */}
      {isAddonModalOpen && (
        <div
          className="dynamic-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="dynamic-modal-content"
            style={{
              background: "#222222",
              width: "600px",
              maxWidth: "95vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="dynamic-modal-header"
              style={{
                padding: "15px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                Manage Installed Addons: {selectedServer}
              </h3>
              <button
                onClick={handleCloseAddonModal}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-color)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                padding: "0 15px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              <button
                className={`tab-button ${addonModalTab === "behavior" ? "active" : ""}`}
                onClick={() => setAddonModalTab("behavior")}
                style={{
                  padding: "10px",
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
              >
                Behavior Packs
              </button>
              <button
                className={`tab-button ${addonModalTab === "resource" ? "active" : ""}`}
                onClick={() => setAddonModalTab("resource")}
                style={{
                  padding: "10px",
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
              >
                Resource Packs
              </button>
            </div>

            <div
              className="dynamic-modal-body"
              style={{ padding: "15px", overflowY: "auto", flex: 1 }}
            >
              {addonsLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
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
                          padding: "20px",
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
                          padding: "20px",
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
                padding: "15px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                className="action-button secondary"
                onClick={handleCloseAddonModal}
              >
                Close
              </button>
              <button
                className="action-button primary"
                onClick={handleSaveAddonOrder}
                disabled={!orderChanged || actionLoading}
              >
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tab-content">
        {isUploadEnabled && (
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              background: "var(--input-background-color)",
              borderRadius: "5px",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Upload{" "}
              {activeTab === "worlds"
                ? "World (.mcworld)"
                : "Addon (.mcpack, .mcaddon)"}
            </h3>
            <input
              type="file"
              onChange={handleUpload}
              disabled={loading || actionLoading}
              className="form-input"
            />
            <p
              style={{
                fontSize: "0.85em",
                color: "var(--text-color-secondary)",
                marginTop: "5px",
              }}
            >
              Uploaded files will appear in the list below.
            </p>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--text-color-secondary)",
            }}
          >
            <div className="spinner"></div> Loading available content...
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="server-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th style={{ width: "150px" }}>Actions</th>
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
                            gap: "10px",
                          }}
                        >
                          {activeTab === "worlds" ? (
                            <Folder size={16} style={{ flexShrink: 0 }} />
                          ) : (
                            <Layers size={16} style={{ flexShrink: 0 }} />
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="action-button"
                          onClick={() => handleInstall(item)}
                          title={`Install to ${selectedServer}`}
                          style={{ padding: "5px 10px", fontSize: "0.9em" }}
                          disabled={actionLoading}
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
                        color: "#888",
                        fontStyle: "italic",
                        padding: "20px",
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
