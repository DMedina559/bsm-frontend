import { useResourceMutation } from "../app/resourceQueries";
import { queryKeys } from "../app/queryKeys";
import Modal from "../components/Modal";
import React, { useState } from "react";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { post } from "../api";
import { logger } from "../utils/logger";
import { Users, X } from "lucide-react";
const OnlinePlayers = () => {
  const { selectedServer, servers } = useServer();
  const { addToast } = useToast();

  // Modals state
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [selectedPlayerXuid, setSelectedPlayerXuid] = useState(null);
  const [banReason, setBanReason] = useState("");

  // Form states
  const [kickReason, setKickReason] = useState("");
  const [transferHost, setTransferHost] = useState("");
  const [transferPort, setTransferPort] = useState("19132");
  const currentServerObj = servers.find((s) => s.name === selectedServer);
  const players = currentServerObj?.players || [];
  const write = useResourceMutation(
    ({ method, url, body }) => {
      if (method === "post")
        return body === undefined ? post(url) : post(url, body);
    },
    [queryKeys.servers(), queryKeys.access([selectedServer, "bans"])],
  );

  const loadingAction = write.isPending;
  const writePost = (url, body) =>
    write.mutateAsync({ url, body, method: "post" });
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
    setBanModalOpen(false);
    setSelectedPlayer(null);
    setSelectedPlayerXuid(null);
    setBanReason("");
  };
  const handleOpenBanModal = (playerName, playerXuid) => {
    if (!playerXuid) {
      addToast(
        "Cannot ban player: XUID is missing. Try kicking instead.",
        "warning",
      );
      return;
    }
    setSelectedPlayer(playerName);
    setSelectedPlayerXuid(playerXuid);
    setBanReason("");
    setBanModalOpen(true);
  };
  const handleBanPlayer = async () => {
    if (!selectedServer || !selectedPlayer || !selectedPlayerXuid) return;
    logger.info(`[OnlinePlayers] Banning player`, {
      player: selectedPlayer,
      xuid: selectedPlayerXuid,
      server: selectedServer,
      reason: banReason,
    });

    try {
      await writePost(`/api/server/${selectedServer}/bans/add`, {
        player_name: selectedPlayer,
        xuid: selectedPlayerXuid,
        reason: banReason || null,
      });
      addToast(`${selectedPlayer} has been banned.`, "success");
      closeModals();
    } catch (error) {
      logger.error(`[OnlinePlayers] Failed to ban player`, {
        error,
        player: selectedPlayer,
        server: selectedServer,
      });
      addToast(error.message || `Failed to ban ${selectedPlayer}.`, "error");
    }
  };
  const handleKickPlayer = async () => {
    if (!selectedServer || !selectedPlayer) return;
    const commandToExecute = kickReason.trim()
      ? `kick "${selectedPlayer}" ${kickReason}`
      : `kick "${selectedPlayer}"`;
    logger.info(`[OnlinePlayers] Kicking player`, {
      player: selectedPlayer,
      server: selectedServer,
      reason: kickReason,
    });

    try {
      await writePost(`/api/server/${selectedServer}/send_command`, {
        command: commandToExecute,
      });
      addToast(`Kick command sent for ${selectedPlayer}.`, "success");
      closeModals();
    } catch (error) {
      logger.error(`[OnlinePlayers] Failed to kick player`, {
        error,
        player: selectedPlayer,
        server: selectedServer,
      });
      addToast(error.message || `Failed to kick ${selectedPlayer}.`, "error");
    }
  };
  const handleTransferPlayer = async () => {
    if (!selectedServer || !selectedPlayer || !transferHost) {
      addToast("Hostname/IP is required for transfer.", "error");
      return;
    }
    const port = Number(transferPort);
    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      /[\s"\\]/.test(transferHost)
    ) {
      addToast(
        "Enter a valid hostname or IP and a port from 1 to 65535.",
        "error",
      );
      return;
    }
    const commandToExecute = `transfer "${selectedPlayer}" ${transferHost} ${transferPort}`;
    logger.info(`[OnlinePlayers] Transferring player`, {
      player: selectedPlayer,
      host: transferHost,
      port: transferPort,
      server: selectedServer,
    });

    try {
      await writePost(`/api/server/${selectedServer}/send_command`, {
        command: commandToExecute,
      });
      addToast(`Transfer command sent for ${selectedPlayer}.`, "success");
      closeModals();
    } catch (error) {
      logger.error(`[OnlinePlayers] Failed to transfer player`, {
        error,
        player: selectedPlayer,
        server: selectedServer,
      });
      addToast(
        error.message || `Failed to transfer ${selectedPlayer}.`,
        "error",
      );
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
        <div
          className="status-text"
          style={{
            color: "var(--text-color-secondary)",
          }}
        >
          <Users
            size={16}
            style={{
              marginRight: "5px",
              verticalAlign: "middle",
            }}
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
              color: "var(--text-color-secondary)",
              fontStyle: "italic",
              textAlign: "center",
              padding: "20px",
            }}
          >
            No players currently online.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {players.map((player) => (
              <div
                key={player.xuid || player.uuid || player.name}
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "bold",
                      fontSize: "1.1em",
                    }}
                  >
                    {player.name}
                  </span>
                  {(player.xuid || player.uuid) && (
                    <span
                      style={{
                        fontSize: "0.8em",
                        color: "var(--text-color-secondary)",
                        fontFamily: "monospace",
                      }}
                    >
                      XUID: {player.xuid || player.uuid}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                  }}
                >
                  <button
                    className="action-button secondary"
                    onClick={() => handleOpenTransferModal(player.name)}
                    disabled={loadingAction}
                    type="button"
                  >
                    Transfer
                  </button>
                  <button
                    className="action-button danger-button"
                    onClick={() => handleOpenKickModal(player.name)}
                    disabled={loadingAction}
                    type="button"
                  >
                    Kick
                  </button>
                  <button
                    className="action-button danger-button"
                    onClick={() =>
                      handleOpenBanModal(
                        player.name,
                        player.xuid || player.uuid,
                      )
                    }
                    disabled={loadingAction || !(player.xuid || player.uuid)}
                    title={
                      !(player.xuid || player.uuid)
                        ? "XUID required to ban"
                        : "Ban Player"
                    }
                    type="button"
                  >
                    Ban
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ban Modal */}
      {banModalOpen && (
        <Modal
          title={<>Ban {selectedPlayer}</>}
          onClose={closeModals}
          closeDisabled={loadingAction}
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
          ></div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <div
              style={{
                background: "rgba(244, 67, 54, 0.1)",
                border: "1px solid rgba(244, 67, 54, 0.3)",
                padding: "10px",
                borderRadius: "4px",
                color: "var(--bsm-danger)",
                fontSize: "0.9em",
              }}
            >
              Warning: This will prevent the player from joining the server.
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "var(--text-color)",
                }}
                htmlFor="onlineplayers-field-1"
              >
                Reason (Optional)
              </label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="form-input"
                placeholder="e.g. Breaking rules"
                style={{
                  width: "100%",
                  padding: "8px",
                  boxSizing: "border-box",
                }}
                autoFocus
                id="onlineplayers-field-1"
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
                type="button"
              >
                Cancel
              </button>
              <button
                className="action-button danger-button"
                onClick={handleBanPlayer}
                disabled={loadingAction}
                type="button"
              >
                Confirm Ban
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Kick Modal */}
      {kickModalOpen && (
        <Modal
          title={<>Kick {selectedPlayer}</>}
          onClose={closeModals}
          closeDisabled={loadingAction}
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
          ></div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "var(--text-color-secondary)",
                }}
                htmlFor="onlineplayers-field-2"
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
                id="onlineplayers-field-2"
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
                type="button"
              >
                Cancel
              </button>
              <button
                className="action-button danger-button"
                onClick={handleKickPlayer}
                disabled={loadingAction}
                type="button"
              >
                Confirm Kick
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {transferModalOpen && (
        <Modal
          title={<>Transfer {selectedPlayer}</>}
          onClose={closeModals}
          closeDisabled={loadingAction}
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
          ></div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "var(--text-color-secondary)",
                }}
                htmlFor="onlineplayers-field-3"
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
                id="onlineplayers-field-3"
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "var(--text-color-secondary)",
                }}
                htmlFor="onlineplayers-field-4"
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
                id="onlineplayers-field-4"
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
                type="button"
              >
                Cancel
              </button>
              <button
                className="action-button start-button"
                onClick={handleTransferPlayer}
                disabled={loadingAction || !transferHost}
                type="button"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default OnlinePlayers;
