import ServerCardMenu from "./ServerCardMenu";
import "../../styles/server-card.css";
import {
  Play,
  Square,
  RotateCcw,
  Users,
  Download,
  Terminal,
} from "lucide-react";
import { resolveApiUrl } from "../../api/transport";
import { resolveOperationUrl } from "../../api/operations";
import { getApiProxyBasePath } from "../../utils/basePath";

const actionDefinitions = {
  start: {
    Icon: Play,
    label: "Start",
    title: "Start Server",
    className: "start-button",
  },
  stop: {
    Icon: Square,
    label: "Stop",
    title: "Stop Server",
    className: "danger-button",
  },
  restart: {
    Icon: RotateCcw,
    label: "Restart",
    title: "Restart Server",
    className: "warning-button",
  },
  update: {
    Icon: Download,
    label: "Update",
    title: "Update Server",
    className: "secondary",
  },
  command: {
    Icon: Terminal,
    label: "Command",
    title: "Send Command",
    className: "secondary",
  },
};

export default function ServerCard({
  server,
  busy,
  onOpen,
  onAction,
  onUpdate,
  onCommand,
}) {
  const status = String(server.status || "unknown").toLowerCase();
  const running = status === "running";
  const stopped = status === "stopped";
  const stable = running || stopped;
  const actions = [
    ...(!running ? ["start"] : []),
    ...(running ? ["stop", "restart"] : []),
    "update",
    "command",
  ];
  const performAction = (event, action) => {
    event.stopPropagation();
    if (action === "update") return onUpdate(event, server.name);
    if (action === "command") return onCommand(event, server.name);
    return onAction(event, server.name, action);
  };
  const playerNames = server.players
    ?.map((player) => player.name)
    .filter(Boolean)
    .join("\n");

  return (
    <article
      className="server-card overview-server-card"
      aria-label={`${server.name} server`}
    >
      <button
        type="button"
        className="server-card-open"
        onClick={() => onOpen(server.name)}
        aria-label={`Open ${server.name} monitor`}
      />
      <div className="card-header overview-card-header">
        <img
          className="overview-world-icon"
          src={resolveApiUrl(
            resolveOperationUrl("get_world_icon", {
              path: { server_name: server.name },
            }),
          )}
          alt=""
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = `${getApiProxyBasePath()}/app/image/icon/favicon-96x96.png`;
          }}
        />
        <div className="overview-server-identity">
          <h3>{server.name}</h3>
          <div className={`overview-server-status overview-status-${status}`}>
            <span className="overview-status-dot" aria-hidden="true" />
            <span>{status.toUpperCase()}</span>
          </div>
        </div>
        <ServerCardMenu serverName={server.name} onNavigate={onOpen} />
      </div>
      <div className="card-body overview-card-body">
        <div className="overview-detail-row">
          <span>Version</span>
          <strong>{server.version || "N/A"}</strong>
        </div>
        <div className="overview-detail-row">
          <span className="overview-player-label">
            <Users size={15} aria-hidden="true" /> Players
          </span>
          <strong title={playerNames || "No players online"}>
            {server.player_count ?? "—"}
          </strong>
        </div>
      </div>
      <div
        className="card-actions overview-card-actions"
        aria-label={`${server.name} quick actions`}
      >
        {actions.map((action) => {
          const { Icon, label, title, className } = actionDefinitions[action];
          const disabled =
            busy ||
            (action === "update" && !stable) ||
            (action === "command" && !running);
          return (
            <button
              key={action}
              type="button"
              className={`action-button ${className}`}
              title={title}
              aria-label={
                action === "command"
                  ? `Send command to ${server.name}`
                  : `${label} ${server.name}`
              }
              disabled={disabled}
              onClick={(event) => performAction(event, action)}
            >
              <Icon size={14} aria-hidden="true" /> <span>{label}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
