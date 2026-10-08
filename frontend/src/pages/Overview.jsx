import "./Overview.css";
import OverviewServerCard from "./OverviewServerCard";
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
import { sortServers, readServerSort, SERVER_SORTS } from "../utils/serverSort";
import { summarizeFleet } from "../utils/fleetStatus";
import {
  Users,
  RefreshCw,
} from "lucide-react";
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
  const [sort, setSort] = useState(readServerSort);
  const sortedServers = sortServers(servers, sort.key, sort.direction);
  const updateSort = (patch) => {
    const next = { ...sort, ...patch };
    setSort(next);
    try {
      localStorage.setItem("bsm.fleet-sort.v4", JSON.stringify(next));
    } catch {
      /* Sorting remains available without browser storage. */
    }
  };

  // Force refresh servers list when navigating back to Overview,
  // guaranteeing fresh status (e.g. after navigating back from Monitor)
  React.useEffect(() => {
    refreshServers();
  }, [refreshServers]);
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
      await post(`/api/server/${serverName}/${action}`);
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
      refreshServers();
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
      await post(`/api/server/${serverName}/update`);
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
      refreshServers();
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
      await post(`/api/server/${serverName}/send_command`, {
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
  const { running, stopped, playersKnown, players } = summarizeFleet(servers);
  const connection = isConnected
    ? "Live updates connected"
    : isFallback
      ? "Polling fallback"
      : "Live updates disconnected";
  const unavailable = (loading || error) && servers.length === 0;
  return (
    <div className="container workspace-overview">
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <p className="workspace-eyebrow">BEDROCK SERVER MANAGER</p>
          <h1>Overview</h1>
          <p className="workspace-subtitle">
            Your server fleet. One control plane.
          </p>
        </div>
        <button
          className="action-button secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" /> {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="workspace-hero overview-intro" aria-label="Connection status">
        <img
          src={`${getApiProxyBasePath()}/app/image/icon/manager-logo.png`}
          alt=""
        />
        <div>
          <span className="workspace-eyebrow">FLEET CONTROL</span>
          <h2>Built for your Bedrock worlds.</h2>
          <p>
            Manage servers, players, backups, and extensions from one workspace.
          </p>
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
      <section className="workspace-metrics overview-metrics" aria-label="Fleet status">
        {[
          [
            "Managed servers",
            servers.length,
            "Servers visible to your account",
          ],
          [
            "Running",
            running,
            `${stopped} stopped · ${servers.length - running - stopped} other`,
          ],
          [
            "Players online",
            playersKnown ? players : "—",
            playersKnown
              ? "Across your visible fleet"
              : "Some player counts unavailable",
          ],
        ].map(([label, value, detail]) => (
          <article className="workspace-metric" key={label}>
            <span className="overview-metric-title">{label}</span>
            <strong>{unavailable ? "—" : value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>
      <div className="fleet-heading">
        <h2>Server fleet</h2>
        <div className="fleet-sort-controls">
          <span>{servers.length} visible servers</span>
          <label htmlFor="fleet-sort">Sort by</label>
          <select
            id="fleet-sort"
            className="form-input"
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
        <div
          className="message-box message-info"
          style={{
            textAlign: "center",
            padding: "40px",
          }}
        >
          <h3>No servers found.</h3>
          {user?.role === "admin" && (
            <p>
              Go to &quot;Install Server&quot; in the sidebar to create one.
            </p>
          )}
        </div>
      ) : (
        <div
          className="server-grid overview-server-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, var(--bsm-card-min-width)), 1fr))",
            gap: "var(--bsm-grid-gap)",
          }}
        >
          {sortedServers.map((server) => (
            <OverviewServerCard key={server.name} server={server} busy={Boolean(actionLoading[server.name])} onOpen={handleServerClick} onAction={handleAction} onUpdate={handleUpdate} onCommand={handleSendCommand} />
          ))}        </div>
      )}
    </div>
  );
};
export default Overview;
