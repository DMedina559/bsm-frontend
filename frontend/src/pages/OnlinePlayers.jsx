import React, { useState } from "react";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { post } from "../api";
import { logger } from "../utils/logger";
import { Users, X } from "lucide-react";

const OnlinePlayers = () => {
  const { selectedServer, servers } = useServer();
  const { addToast } = useToast();
  const [loadingAction, setLoadingAction] = useState(false);

  // Modals state
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Form states
  const [kickReason, setKickReason] = useState("");
  const [transferHost, setTransferHost] = useState("");
  const [transferPort, setTransferPort] = useState("19132");

  const currentServerObj = servers.find((s) => s.name === selectedServer);
  const players = currentServerObj?.players || [];

  const handleOpenKickModal = (playerName) => {
    setSelectedPlayer(playerName);
    setKickReason("");
    setKickModalOpen(true);
  };

  const handleOpenTransferModal = (playerName) => {
    setSelectedPlayer(playerName);
    setTransferHost("");
    setTransferPort("19132");
    setTransferModalOpen(true);
  };

  const closeModals = () => {
    setKickModalOpen(false);
    setTransferModalOpen(false);
    setSelectedPlayer(null);
  };

  const handleKickPlayer = async () => {
    if (!selectedServer || !selectedPlayer) return;

    const commandToExecute = kickReason.trim()
      ? `kick "${selectedPlayer}" ${kickReason}`
      : `kick "${selectedPlayer}"`;

    logger.info(
      `[OnlinePlayers] Kicking player ${selectedPlayer} from ${selectedServer}`,
    );
    setLoadingAction(true);
    try {
      await post(`/api/server/${selectedServer}/send_command`, {
        command: commandToExecute,
      });
      addToast(`Kick command sent for ${selectedPlayer}.`, "success");
      closeModals();
    } catch (error) {
      logger.error(
        `[OnlinePlayers] Failed to kick player ${selectedPlayer}`,
        error,
      );
      addToast(error.message || `Failed to kick ${selectedPlayer}.`, "error");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTransferPlayer = async () => {
    if (!selectedServer || !selectedPlayer || !transferHost) {
      addToast("Hostname/IP is required for transfer.", "error");
      return;
    }

    const commandToExecute = `transfer "${selectedPlayer}" ${transferHost} ${transferPort}`;

    logger.info(
      `[OnlinePlayers] Transferring player ${selectedPlayer} to ${transferHost}:${transferPort}`,
    );
    setLoadingAction(true);
    try {
      await post(`/api/server/${selectedServer}/send_command`, {
        command: commandToExecute,
      });
      addToast(`Transfer command sent for ${selectedPlayer}.`, "success");
      closeModals();
    } catch (error) {
      logger.error(
        `[OnlinePlayers] Failed to transfer player ${selectedPlayer}`,
        error,
      );
      addToast(
        error.message || `Failed to transfer ${selectedPlayer}.`,
        "error",
      );
    } finally {
      setLoadingAction(false);
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
          Please select a server from the sidebar.
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
        <h1>Online Players: {selectedServer}</h1>
        <div className="status-text" style={{ color: "#aaa" }}>
          <Users
            size={16}
            style={{ marginRight: "5px", verticalAlign: "middle" }}
          />
          {players.length} Online
        </div>
      </div>

      <div
        style={{
          background: "var(--container-background-color, #333)",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid var(--border-color, #555)",
        }}
      >
        {players.length === 0 ? (
          <div
            style={{
              color: "#aaa",
              fontStyle: "italic",
              textAlign: "center",
              padding: "20px",
            }}
          >
            No players currently online.
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {players.map((player, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.2)",
                  padding: "15px",
                  borderRadius: "4px",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "15px" }}
                >
                  <span style={{ fontWeight: "bold", fontSize: "1.1em" }}>
                    {player.name}
                  </span>
                  {player.uuid && (
                    <span
                      style={{
                        fontSize: "0.8em",
                        color: "#888",
                        fontFamily: "monospace",
                      }}
                    >
                      XUID: {player.uuid}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="action-button secondary"
                    onClick={() => handleOpenTransferModal(player.name)}
                    disabled={loadingAction}
                  >
                    Transfer
                  </button>
                  <button
                    className="action-button danger-button"
                    onClick={() => handleOpenKickModal(player.name)}
                    disabled={loadingAction}
                  >
                    Kick
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kick Modal */}
      {kickModalOpen && (
        <div
          className="modal-backdrop"
          onClick={closeModals}
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
              maxWidth: "400px",
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
              <h3 style={{ margin: 0 }}>Kick {selectedPlayer}</h3>
              <button
                onClick={closeModals}
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
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    color: "#ccc",
                  }}
                >
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={kickReason}
                  onChange={(e) => setKickReason(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Breaking rules"
                  style={{
                    width: "100%",
                    padding: "8px",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  className="action-button secondary"
                  onClick={closeModals}
                >
                  Cancel
                </button>
                <button
                  className="action-button danger-button"
                  onClick={handleKickPlayer}
                  disabled={loadingAction}
                >
                  Confirm Kick
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModalOpen && (
        <div
          className="modal-backdrop"
          onClick={closeModals}
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
              maxWidth: "400px",
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
              <h3 style={{ margin: 0 }}>Transfer {selectedPlayer}</h3>
              <button
                onClick={closeModals}
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
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    color: "#ccc",
                  }}
                >
                  Hostname or IP *
                </label>
                <input
                  type="text"
                  value={transferHost}
                  onChange={(e) => setTransferHost(e.target.value)}
                  className="form-input"
                  placeholder="play.example.com"
                  style={{
                    width: "100%",
                    padding: "8px",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    color: "#ccc",
                  }}
                >
                  Port *
                </label>
                <input
                  type="text"
                  value={transferPort}
                  onChange={(e) => setTransferPort(e.target.value)}
                  className="form-input"
                  style={{
                    width: "100%",
                    padding: "8px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  className="action-button secondary"
                  onClick={closeModals}
                >
                  Cancel
                </button>
                <button
                  className="action-button start-button"
                  onClick={handleTransferPlayer}
                  disabled={loadingAction || !transferHost}
                >
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlinePlayers;
