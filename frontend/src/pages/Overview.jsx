import { useResourceMutation } from "../app/resourceQueries";
import { queryKeys } from "../app/queryKeys";
import { usePreference } from "../app/usePreference";
import "./Overview.css";
import OverviewServerCard from "./OverviewServerCard";
import OverviewFleetMetrics from "./OverviewFleetMetrics";
import { useDialog } from "../DialogContext";
import React, { useState } from "react";
import { useServer } from "../ServerContext";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { getApiProxyBasePath } from "../utils/basePath";
import { useWebSocket } from "../WebSocketContext";
import { useNavigate } from "react-router-dom";
import { post } from "../api";
import { logger } from "../utils/logger";
import { sortServers, SERVER_SORTS } from "../utils/serverSort";
import { RefreshCw, LayoutGrid, List, Grid2X2 } from "lucide-react";
const LAYOUTS = [
  { id: "grid", label: "Grid", Icon: LayoutGrid },
  { id: "compact", label: "Compact", Icon: Grid2X2 },
  { id: "list", label: "List", Icon: List },
];

const Overview = () => {
  const { confirmAction, promptAction } = useDialog();
  const { servers, setSelectedServer, refreshServers, loading, error } =
    useServer();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { isConnected, isFallback, reconnect } = useWebSocket();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [layout, updateLayout] = usePreference("overviewLayout", "grid");
  const [sort, setSort] = usePreference("serverSort", {
    key: "name",
    direction: "asc",
  });
  const sortedServers = sortServers(servers, sort.key, sort.direction);
  const updateSort = (patch) => setSort({ ...sort, ...patch });

  const write = useResourceMutation(
    ({ method, url, body }) => {
      if (method === "post")
        return body === undefined ? post(url) : post(url, body);
    },
    [queryKeys.servers()],
  );
  const writePost = (url, body) =>
    write.mutateAsync({ url, body, method: "post" });
  const handleServerClick = (serverName) => {
    setSelectedServer(serverName);
    navigate("/monitor");
  };
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    logger.debug("[Overview] Manually refreshing server list");
    addToast("Refreshing server list...", "info");
    try {
      const refreshed = await refreshServers();
      if (refreshed === false)
        throw new Error("Server list could not be refreshed.");
      addToast("Server list refreshed.", "success");
    } catch (error) {
      logger.error("[Overview] Failed to refresh server list", {
        error,
      });
      addToast("Failed to refresh server list.", "error");
    } finally {
      setRefreshing(false);
    }
  };
  const handleAction = async (e, serverName, action) => {
    // Prevent click from bubbling up to the card click handler
    e.stopPropagation();

    // Trigger WS reconnect if disconnected, regardless of action outcome
    if (!isConnected) {
      reconnect();
    }
    if (actionLoading[serverName]) return;
    logger.info("[Overview] Sending server action", {
      server: serverName,
      action,
    });
    setActionLoading((prev) => ({
      ...prev,
      [serverName]: true,
    }));
    addToast(`Sending ${action} signal to ${serverName}...`, "info");
    try {
      await writePost(`/api/server/${serverName}/${action}`);
      addToast(`Signal ${action} sent to ${serverName}.`, "success");
    } catch (error) {
      logger.error("[Overview] Failed to send server action", {
        error,
        server: serverName,
        action,
      });
      addToast(error.message || `Failed to ${action} server.`, "error");
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [serverName]: false,
      }));
      // Ensure UI reflects the latest state, even if WS messages are missed
    }
  };
  const handleUpdate = async (e, serverName) => {
    e.stopPropagation();

    // Trigger WS reconnect if disconnected
    if (!isConnected) {
      reconnect();
    }
    if (
      !(await confirmAction(
        `Are you sure you want to update ${serverName}? The server will stop if running.`,
      ))
    )
      return;
    logger.info("[Overview] Initiating server update", {
      server: serverName,
    });
    setActionLoading((prev) => ({
      ...prev,
      [serverName]: true,
    }));
    addToast(`Updating ${serverName}...`, "info");
    try {
      await writePost(`/api/server/${serverName}/update`);
      addToast(`Update initiated for ${serverName}.`, "success");
    } catch (error) {
      logger.error("[Overview] Failed to initiate update", {
        error,
        server: serverName,
      });
      addToast(error.message || `Failed to update ${serverName}.`, "error");
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [serverName]: false,
      }));
    }
  };
  const handleSendCommand = async (e, serverName) => {
    e.stopPropagation();
    e.preventDefault();

    // Trigger WS reconnect if disconnected
    if (!isConnected) {
      reconnect();
    }
    const command = await promptAction(
      `Enter command to send to ${serverName}:`,
    );
    if (!command) return;
    logger.info("[Overview] Sending console command", {
      server: serverName,
      command,
    });
    setActionLoading((prev) => ({
      ...prev,
      [serverName]: true,
    }));
    try {
      await writePost(`/api/server/${serverName}/send_command`, {
        command,
      });
      addToast(`Command sent to ${serverName}.`, "success");
    } catch (error) {
      logger.error("[Overview] Failed to send console command", {
        error,
        server: serverName,
        command,
      });
      addToast(
        error.message || `Failed to send command to ${serverName}.`,
        "error",
      );
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [serverName]: false,
      }));
    }
  };
  const connection = isConnected
    ? "Live updates connected"
    : isFallback
      ? "Polling fallback"
      : "Live updates disconnected";
  const unavailable = (loading || error) && servers.length === 0;
  return (
    <div className="container workspace-overview">
      <header className="overview-page-heading">
        <div className="overview-heading-copy">
          <h1>Overview</h1>
        </div>
        <button
          className="action-button secondary overview-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="overview-dashboard-top">
        <section
          className="workspace-hero overview-intro"
          aria-label="Application overview"
        >
          <img
            src={`${getApiProxyBasePath()}/app/image/icon/manager-logo.png`}
            alt=""
          />
          <div>
            <span className="workspace-eyebrow">BEDROCK SERVER MANAGER</span>
            <h2>Your Bedrock workspace</h2>
            <p>Manage servers, players, backups, and extensions.</p>
            <div
              className={`connection-pill ${isConnected ? "connected" : "degraded"}`}
              role="status"
            >
              {connection}
            </div>
          </div>
          {!isConnected && (
            <button
              className="action-button secondary"
              onClick={reconnect}
              type="button"
            >
              Reconnect
            </button>
          )}
        </section>
        <OverviewFleetMetrics servers={servers} unavailable={unavailable} />
      </div>
      <div className="fleet-heading">
        <h2>Server fleet</h2>
        <div className="fleet-sort-controls">
          <div
            className="overview-layout-switch"
            role="group"
            aria-label="Server layout"
          >
            {LAYOUTS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={`overview-layout-button ${layout === id ? "is-active" : ""}`}
                aria-pressed={layout === id}
                onClick={() => updateLayout(id)}
                title={`${label} layout`}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <span className="overview-server-count">
            {servers.length} servers
          </span>
          <label className="sr-only" htmlFor="fleet-sort">
            Sort by
          </label>
          <select
            id="fleet-sort"
            className="form-input"
            aria-label="Sort servers by"
            value={sort.key}
            onChange={(e) => updateSort({ key: e.target.value })}
          >
            {Object.entries(SERVER_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="fleet-sort-direction">
            Sort direction
          </label>
          <select
            id="fleet-sort-direction"
            className="form-input"
            aria-label="Sort direction"
            value={sort.direction}
            onChange={(e) => updateSort({ direction: e.target.value })}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="message-box message-error" role="alert">
          Unable to load fleet status: {error}. Displayed servers may be out of
          date.
        </div>
      )}
      {loading && servers.length === 0 ? (
        <p role="status">Loading server fleet…</p>
      ) : error && servers.length === 0 ? null : servers.length === 0 ? (
        <div className="message-box message-info overview-empty">
          <h3>No servers found.</h3>
          {user?.role === "admin" && (
            <p>
              Go to &quot;Install Server&quot; in the sidebar to create one.
            </p>
          )}
        </div>
      ) : (
        <div
          className={`server-grid overview-server-grid overview-layout-${layout}`}
        >
          {sortedServers.map((server) => (
            <OverviewServerCard
              key={server.name}
              server={server}
              busy={Boolean(actionLoading[server.name])}
              onOpen={handleServerClick}
              onAction={handleAction}
              onUpdate={handleUpdate}
              onCommand={handleSendCommand}
            />
          ))}
        </div>
      )}
    </div>
  );
};
export default Overview;
