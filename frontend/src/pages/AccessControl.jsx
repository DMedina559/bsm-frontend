import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Scan,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { del, get, post, put } from "../api";
import { logger } from "../utils/logger";

const AccessControl = () => {
  const { selectedServer } = useServer();
  const [activeTab, setActiveTab] = useState("allowlist");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add Form State
  const [playerName, setPlayerName] = useState("");
  const [playerXuid, setPlayerXuid] = useState(""); // New state for XUID
  const [permissionLevel, setPermissionLevel] = useState("member");
  const [ignoresPlayerLimit, setIgnoresPlayerLimit] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [banReason, setBanReason] = useState("");

  // Online Players Modal State
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [kickReasons, setKickReasons] = useState({});
  const { servers } = useServer();

  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const setupFlow = location.state?.setupFlow;

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const fetchItems = useCallback(async () => {
    if (!selectedServer) return;
    setLoading(true);

    try {
      let endpoint = "";
      if (activeTab === "allowlist")
        endpoint = `/api/server/${selectedServer}/allowlist/get`;
      else if (activeTab === "permissions")
        endpoint = `/api/server/${selectedServer}/permissions/get`;
      else if (activeTab === "bans")
        endpoint = `/api/server/${selectedServer}/bans/get`;

      const data = await get(endpoint);
      if (data) {
        if (activeTab === "allowlist") setItems(data.players || []);
        else if (activeTab === "permissions") setItems(data.permissions || []);
        else if (activeTab === "bans") setItems(data.bans || []);
      } else {
        setItems([]);
      }
    } catch (error) {
      logger.error(`Error fetching ${activeTab}:`, error);
      addToast(error.message || `Error fetching ${activeTab}`, "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedServer, activeTab, addToast]);

  useEffect(() => {
    if (selectedServer) {
      fetchItems();
    }
  }, [selectedServer, activeTab, fetchItems]);

  const handleNextStep = () => {
    // In setup flow, permissions usually follows allowlist, then config
    if (activeTab === "allowlist") {
      setActiveTab("permissions");
    } else {
      navigate("/server-config", { state: { setupFlow: true } });
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedServer || !playerName) return;

    if ((activeTab === "permissions" || activeTab === "bans") && !playerXuid) {
      addToast("XUID is required.", "error");
      return;
    }

    setActionLoading(true);
    try {
      if (activeTab === "allowlist") {
        await post(`/api/server/${selectedServer}/allowlist/add`, {
          players: [playerName],
          ignoresPlayerLimit: ignoresPlayerLimit,
        });
      } else if (activeTab === "bans") {
        await post(`/api/server/${selectedServer}/bans/add`, {
          player_name: playerName,
          xuid: playerXuid,
          reason: banReason || null,
        });
      } else {
        await put(`/api/server/${selectedServer}/permissions/set`, {
          // Permission endpoint expects a list of objects
          permissions: [
            {
              xuid: playerXuid,
              name: playerName,
              permission_level: permissionLevel,
            },
          ],
        });
      }

      addToast(`${playerName} added/updated in ${activeTab}.`, "success");
      setPlayerName("");
      setPlayerXuid("");
      setBanReason("");
      setIgnoresPlayerLimit(false);

      fetchItems();
    } catch (error) {
      addToast(error.message || "Failed to add item.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickPlayer = async (kickPlayerName) => {
    if (!selectedServer) return;

    const reason = kickReasons[kickPlayerName] || "";
    const commandToExecute = reason.trim()
      ? `kick "${kickPlayerName}" ${reason}`
      : `kick "${kickPlayerName}"`;

    logger.info(
      `[AccessControl] Kicking player ${kickPlayerName} from ${selectedServer} with reason: ${reason}`,
    );
    setActionLoading(true);
    try {
      await post(`/api/server/${selectedServer}/send_command`, {
        command: commandToExecute,
      });
      addToast(`Kick command sent for ${kickPlayerName}.`, "success");
      setKickReasons((prev) => ({ ...prev, [kickPlayerName]: "" }));
    } catch (error) {
      logger.error(
        `[AccessControl] Failed to kick player ${kickPlayerName} from ${selectedServer}`,
        error,
      );
      addToast(error.message || `Failed to kick ${kickPlayerName}.`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (item) => {
    if (!selectedServer) return;
    const name =
      item.name || item.player_name || item.xuid || item.uuid || "Unknown";
    if (!confirm(`Remove ${name} from ${activeTab}?`)) return;

    setActionLoading(true);
    try {
      if (activeTab === "allowlist") {
        await del(`/api/server/${selectedServer}/allowlist/remove`, {
          body: { players: [item.name || item.xuid] },
        });
        addToast("Player removed from allowlist.", "success");
        fetchItems();
      } else if (activeTab === "bans") {
        await del(`/api/server/${selectedServer}/bans/remove`, {
          body: { xuid: item.xuid || item.uuid },
        });
        addToast("Player removed from ban list.", "success");
        fetchItems();
      } else {
        addToast(
          "To remove permission, please set level to 'Member' (Default).",
          "info",
        );
      }
    } catch (error) {
      addToast(error.message || "Failed to remove item.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermissionChange = async (item, newLevel) => {
    if (!selectedServer) return;

    setActionLoading(true);
    try {
      await put(`/api/server/${selectedServer}/permissions/set`, {
        permissions: [
          {
            xuid: item.xuid,
            name: item.name,
            permission_level: newLevel,
          },
        ],
      });
      addToast(`Updated permission for ${item.name} to ${newLevel}`, "success");
      // Optimistically update the list or refetch
      setItems((prev) =>
        prev.map((p) =>
          p.xuid === item.xuid
            ? { ...p, permission_level: newLevel, permission: newLevel }
            : p,
        ),
      );
    } catch (error) {
      addToast(error.message || "Failed to update permission.", "error");
      fetchItems(); // Revert on error
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanPlayers = async () => {
    setActionLoading(true);
    try {
      await post("/api/players/scan");
      addToast("Player scan initiated. Logs are being processed.", "success");
      // Optionally refresh, though scan is async and updates global DB, might not affect local list immediately
    } catch (error) {
      addToast(error.message || "Failed to scan players.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // New helper to handle refresh with user feedback
  const handleRefresh = async () => {
    setLoading(true);
    addToast(`Refreshing ${activeTab}...`, "info");
    await fetchItems();
    addToast(`${activeTab} refreshed.`, "success");
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
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Access Control: {selectedServer}</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          {!setupFlow && (
            <>
              <button
                className="action-button secondary"
                onClick={() => setShowPlayersModal(true)}
                disabled={actionLoading}
                title="View and kick online players"
                style={{
                  padding: "4px 8px",
                  fontSize: "0.85em",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Users size={14} /> Online
              </button>
              <button
                className="action-button secondary"
                onClick={handleScanPlayers}
                disabled={actionLoading}
                title="Scan server logs for player history"
                style={{
                  padding: "4px 8px",
                  fontSize: "0.85em",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Scan size={14} /> Scan
              </button>
              <button
                className="action-button secondary"
                onClick={handleRefresh}
                disabled={loading || actionLoading}
                title="Reload current list"
                style={{
                  padding: "4px 8px",
                  fontSize: "0.85em",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} />{" "}
                Refresh
              </button>
            </>
          )}
          {setupFlow && (
            <button className="action-button" onClick={handleNextStep}>
              Next Step <ArrowRight size={16} style={{ marginLeft: "5px" }} />
            </button>
          )}
        </div>
      </div>

      {setupFlow && (
        <div
          className="message-box message-info"
          style={{ marginBottom: "20px" }}
        >
          <strong>
            Setup Wizard (Step {activeTab === "allowlist" ? "2" : "3"}/4):
          </strong>{" "}
          Configure {activeTab}.
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "allowlist" ? "active" : ""}`}
          onClick={() => setActiveTab("allowlist")}
        >
          Allowlist
        </button>
        <button
          className={`tab-button ${activeTab === "permissions" ? "active" : ""}`}
          onClick={() => setActiveTab("permissions")}
        >
          Permissions
        </button>
        <button
          className={`tab-button ${activeTab === "bans" ? "active" : ""}`}
          onClick={() => setActiveTab("bans")}
        >
          Bans
        </button>
      </div>

      <div
        className="tab-content"
        style={{
          background: "var(--input-background-color)",
          padding: "20px",
          borderRadius: "0 0 5px 5px",
          border: "1px solid var(--border-color)",
          borderTop: "none",
        }}
      >
        {/* Add Form */}
        <form
          onSubmit={handleAdd}
          className="form-group"
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
            marginBottom: "20px",
            flexWrap: "wrap",
            background: "rgba(0,0,0,0.1)",
            padding: "15px",
            borderRadius: "5px",
          }}
        >
          <div style={{ flexGrow: 1, minWidth: "200px" }}>
            <label
              className="form-label"
              style={{ display: "block", marginBottom: "5px" }}
            >
              Player Name (Gamertag)
            </label>
            <input
              type="text"
              className="form-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
              style={{ width: "100%" }}
              placeholder={
                activeTab === "allowlist"
                  ? "Enter Gamertag to allow..."
                  : activeTab === "bans"
                    ? "Enter Gamertag to ban..."
                    : "Enter Gamertag..."
              }
            />
          </div>

          {(activeTab === "permissions" || activeTab === "bans") && (
            <div style={{ flexGrow: 1, minWidth: "150px" }}>
              <label
                className="form-label"
                style={{ display: "block", marginBottom: "5px" }}
              >
                XUID
              </label>
              <input
                type="text"
                className="form-input"
                value={playerXuid}
                onChange={(e) => setPlayerXuid(e.target.value)}
                required
                style={{ width: "100%" }}
                placeholder="Enter XUID..."
              />
            </div>
          )}

          {activeTab === "bans" && (
            <div style={{ flexGrow: 1, minWidth: "150px" }}>
              <label
                className="form-label"
                style={{ display: "block", marginBottom: "5px" }}
              >
                Reason (Optional)
              </label>
              <input
                type="text"
                className="form-input"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                style={{ width: "100%" }}
                placeholder="Enter ban reason..."
              />
            </div>
          )}
          {activeTab === "permissions" && (
            <div style={{ minWidth: "150px" }}>
              <label
                className="form-label"
                style={{ display: "block", marginBottom: "5px" }}
              >
                Permission Level
              </label>
              <select
                className="form-input"
                value={permissionLevel}
                onChange={(e) => setPermissionLevel(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="visitor">Visitor</option>
                <option value="member">Member</option>
                <option value="operator">Operator</option>
              </select>
            </div>
          )}

          {activeTab === "allowlist" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "10px",
                minWidth: "150px",
              }}
            >
              <label
                className="checkbox-container"
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={ignoresPlayerLimit}
                  onChange={(e) => setIgnoresPlayerLimit(e.target.checked)}
                  style={{ marginRight: "10px" }}
                />
                <span style={{ fontSize: "0.9em" }}>Ignore Player Limit</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="action-button"
            disabled={loading || actionLoading || !playerName}
            style={{ height: "38px" }}
          >
            <Plus size={16} style={{ marginRight: "5px" }} /> Add
          </button>
        </form>

        {/* List */}
        {loading ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--text-color-secondary)",
            }}
          >
            <div className="spinner"></div> Loading {activeTab}...
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="server-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  {(activeTab === "permissions" || activeTab === "bans") && (
                    <th>XUID</th>
                  )}
                  {activeTab === "allowlist" && <th>Attributes</th>}
                  {activeTab === "permissions" && <th>Permission Level</th>}
                  {activeTab === "bans" && <th>Reason</th>}
                  {(activeTab === "allowlist" || activeTab === "bans") && (
                    <th style={{ width: "100px" }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items && items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ fontWeight: "bold" }}>
                          {item.name || item.player_name || "Unknown"}
                        </span>
                      </td>
                      {(activeTab === "permissions" ||
                        activeTab === "bans") && (
                        <td>
                          <span
                            className="mono-text"
                            style={{
                              fontSize: "0.85em",
                              color: "var(--text-color-secondary)",
                            }}
                          >
                            {item.xuid || item.uuid || "N/A"}
                          </span>
                        </td>
                      )}

                      {activeTab === "allowlist" && (
                        <td>
                          {item.ignoresPlayerLimit ? (
                            <span
                              className="badge badge-success"
                              style={{ fontSize: "0.8em" }}
                            >
                              Bypasses Limit
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-color-secondary)",
                                fontSize: "0.8em",
                              }}
                            >
                              -
                            </span>
                          )}
                        </td>
                      )}

                      {activeTab === "permissions" && (
                        <td>
                          <select
                            className="form-input"
                            value={
                              item.permission ||
                              item.permission_level ||
                              "member"
                            }
                            onChange={(e) =>
                              handlePermissionChange(item, e.target.value)
                            }
                            disabled={actionLoading}
                            style={{ padding: "4px 8px", fontSize: "0.9em" }}
                          >
                            <option value="visitor">Visitor</option>
                            <option value="member">Member</option>
                            <option value="operator">Operator</option>
                          </select>
                        </td>
                      )}

                      {activeTab === "bans" && <td>{item.reason || "-"}</td>}
                      {(activeTab === "allowlist" || activeTab === "bans") && (
                        <td>
                          <button
                            className="action-button danger-button"
                            onClick={() => handleRemove(item)}
                            title={`Remove from ${activeTab}`}
                            style={{ padding: "5px 10px" }}
                            disabled={actionLoading}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr className="no-servers-row">
                    <td
                      colSpan={activeTab === "allowlist" ? 3 : 3}
                      className="no-servers"
                      style={{
                        textAlign: "center",
                        color: "var(--text-color-secondary)",
                        fontStyle: "italic",
                        padding: "30px",
                      }}
                    >
                      No entries found in {activeTab}. Use the form above to add
                      one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Players Modal */}
      {showPlayersModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPlayersModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--container-background-color, #333)",
              border: "1px solid var(--border-color, #555)",
              borderRadius: "8px",
              padding: "20px",
              width: "90%",
              maxWidth: "500px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
                borderBottom: "1px solid var(--border-color, #555)",
                paddingBottom: "10px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Users size={20} /> Online Players
              </h3>
              <button
                onClick={() => setShowPlayersModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#aaa",
                  cursor: "pointer",
                  padding: "5px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{ overflowY: "auto", flexGrow: 1, paddingRight: "5px" }}
            >
              {(() => {
                const currentServerObj = servers.find(
                  (s) => s.name === selectedServer,
                );
                const players = currentServerObj?.players || [];

                if (!players || players.length === 0) {
                  return (
                    <div
                      style={{
                        color: "#aaa",
                        fontStyle: "italic",
                        textAlign: "center",
                        padding: "20px",
                      }}
                    >
                      No players online.
                    </div>
                  );
                }

                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {players.map((player, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "rgba(0,0,0,0.2)",
                          padding: "10px",
                          borderRadius: "4px",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span style={{ fontWeight: "bold" }}>
                          {player.name}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Optional reason..."
                            value={kickReasons[player.name] || ""}
                            onChange={(e) =>
                              setKickReasons((prev) => ({
                                ...prev,
                                [player.name]: e.target.value,
                              }))
                            }
                            className="form-input"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.85em",
                              width: "150px",
                            }}
                          />
                          <button
                            className="action-button danger-button"
                            onClick={() => handleKickPlayer(player.name)}
                            disabled={actionLoading}
                            style={{ padding: "4px 10px", fontSize: "0.85em" }}
                          >
                            Kick
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .badge-success { background-color: rgba(76, 175, 80, 0.2); color: #4caf50; border: 1px solid rgba(76, 175, 80, 0.4); padding: 2px 6px; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default AccessControl;
