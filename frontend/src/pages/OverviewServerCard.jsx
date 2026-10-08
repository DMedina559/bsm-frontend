import { Play, Square, RotateCcw, Users, Download, Terminal } from "lucide-react";
import { getApiBaseUrl } from "../api";
import { getApiProxyBasePath } from "../utils/basePath";

const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "running":
        return "var(--bsm-success)";
      case "stopped":
        return "var(--bsm-danger)";
      case "starting":
      case "stopping":
      case "restarting":
        return "var(--bsm-warning)";
      default:
        return "var(--text-color-secondary)";
    }
  };

export default function OverviewServerCard({ server, busy, onOpen, onAction, onUpdate, onCommand }) {
  const actionLoading = { [server.name]: busy };
  return (
<div
              key={server.name}
              className="server-card overview-server-card"
              onClick={() => onOpen(server.name)}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(server.name); } }}
              tabIndex={0}
              role="group"
              aria-label={`${server.name} server`}
              style={{
                background: "var(--container-background-color)",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                position: "relative",
                overflow: "hidden",
              }}

            >
              <div
                className="card-header"
                style={{
                  padding: "var(--bsm-card-padding)",
                  display: "flex",
                  gap: "var(--bsm-grid-gap)",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <img
                  src={`${getApiBaseUrl()}/api/server/${server.name}/world/icon`}
                  alt={server.name}
                  style={{
                    width: "var(--bsm-card-icon-size)",
                    height: "var(--bsm-card-icon-size)",
                    objectFit: "cover",
                    borderRadius: "4px",
                    background: "var(--bsm-surface-raised)",
                  }}
                  onError={(e) => {
                    e.target.onerror = null; // Prevent infinite loop
                    e.target.src = `${getApiProxyBasePath()}/app/image/icon/favicon-96x96.png`;
                  }}
                />
                <div
                  style={{
                    flexGrow: 1,
                    overflow: "hidden",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 5px 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <button
                      type="button"
                      className="server-name-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(server.name);
                      }}
                      aria-label={`Open ${server.name} monitor`}
                    >
                      {server.name}
                    </button>
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.85em",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: getStatusColor(server.status),
                      }}
                    ></span>
                    <span
                      style={{
                        color: getStatusColor(server.status),
                        fontWeight: "bold",
                      }}
                    >
                      {(server.status || "UNKNOWN").toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="card-body"
                style={{
                  padding: "var(--bsm-card-padding)",
                  fontSize: "0.9em",
                  color: "var(--text-color-secondary)",
                }}
              >
                <div
                  style={{
                    marginBottom: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Version:</span>
                  <span
                    style={{
                      color: "var(--text-color)",
                    }}
                  >
                    {server.version || "N/A"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Users size={14} /> Players:
                  </span>
                  <span
                    style={{
                      color: "var(--text-color)",
                      position: "relative",
                      cursor: "help",
                    }}
                    title={
                      server.players && server.players.length > 0
                        ? server.players.map((p) => p.name).join("\n")
                        : "No players online"
                    }
                  >
                    {server.player_count !== undefined
                      ? server.player_count
                      : "-"}
                  </span>
                </div>
              </div>
              <div
                className="card-actions overview-card-actions"
                style={{
                  padding: "var(--bsm-card-padding)",
                  background: "rgba(0,0,0,0.2)",
                  display: "flex",
                  justifyContent: "flex-start",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
                onClick={(e) =>
                  e.stopPropagation()
                } /* Extra safety: stop clicks in the action bar from bubbling to card */
              >
                {server.status?.toLowerCase() === "stopped" && <button
                  className="action-button start-button"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8em",
                  }}
                  onClick={(e) => onAction(e, server.name, "start")}
                  disabled={
                    actionLoading[server.name] || server.status === "running"
                  }
                  aria-label={`Start ${server.name}`}
                  title="Start Server"
                  type="button"
                >
                  <Play size={14} /> <span>Start</span>
                </button>}
                {server.status?.toLowerCase() === "running" && <button
                  className="action-button danger-button"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8em",
                  }}
                  onClick={(e) => onAction(e, server.name, "stop")}
                  disabled={
                    actionLoading[server.name] || server.status === "stopped"
                  }
                  aria-label={`Stop ${server.name}`}
                  title="Stop Server"
                  type="button"
                >
                  <Square size={14} /> <span>Stop</span>
                </button>}
                {server.status?.toLowerCase() === "running" && <button
                  className="action-button warning-button"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8em",
                  }}
                  onClick={(e) => onAction(e, server.name, "restart")}
                  disabled={
                    actionLoading[server.name] || server.status === "stopped"
                  }
                  aria-label={`Restart ${server.name}`}
                  title="Restart Server"
                  type="button"
                >
                  <RotateCcw size={14} /> <span>Restart</span>
                </button>}
                <button
                  className="action-button secondary"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8em",
                  }}
                  onClick={(e) => onUpdate(e, server.name)}
                  disabled={actionLoading[server.name] || !["running", "stopped"].includes(server.status?.toLowerCase())}
                  aria-label={`Update ${server.name}`}
                  title="Update Server"
                  type="button"
                >
                  <Download size={14} /> <span>Update</span>
                </button>
                <button
                  className="action-button secondary"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8em",
                  }}
                  onClick={(e) => onCommand(e, server.name)}
                  disabled={
                    actionLoading[server.name] ||
                    server.status?.toLowerCase() !== "running"
                  }
                  aria-label={`Send command to ${server.name}`}
                  title="Send Command"
                  type="button"
                >
                  <Terminal size={14} /> <span>Command</span>
                </button>
              </div>
            </div>
  );
}
