import { callOperation } from "../api/operations";
import LogViewer from "../components/LogViewer";
import "../styles/monitor.css";
import { queryKeys } from "../app/queryKeys";
import QueryStatus from "../components/QueryStatus";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import React, { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useServer } from "../contexts/ServerContext";
import { useToast } from "../contexts/ToastContext";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Play,
  Square,
  RotateCcw,
  Terminal,
  FileText,
  Users,
  RefreshCw,
} from "lucide-react";
import { logger } from "../utils/logger";
const Monitor = () => {
  const {
    isConnected,
    isFallback,
    subscribe,
    unsubscribe,
    addMessageListener,
  } = useWebSocket();
  const { selectedServer, servers } = useServer();
  const { addToast } = useToast();
  const monitorQuery = useResourceQuery("monitor", selectedServer, {
    refetchInterval: isFallback ? 2000 : false,
  });
  const processInfo = monitorQuery.data ?? null;
  const [usageHistory, setUsageHistory] = useState([]);
  const [command, setCommand] = useState("");
  const [chartReady, setChartReady] = useState(false);
  const chartContainerRef = useRef(null);

  // Use a ResizeObserver to wait until the chart container actually has dimensions
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setChartReady(true);
        } else {
          setChartReady(false);
        }
      }
    });
    observer.observe(chartContainerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [processInfo]); // Re-bind observer when server status changes panel visibility
  const { refetch: fetchStatus } = monitorQuery;
  useEffect(() => {
    if (!isFallback || !processInfo) return;
    setUsageHistory((previous) =>
      [
        ...previous,
        {
          time: new Date().toLocaleTimeString(),
          cpu: processInfo.cpu_percent || 0,
          memory: processInfo.memory_mb || 0,
        },
      ].slice(-20),
    );
  }, [isFallback, processInfo, monitorQuery.dataUpdatedAt]);

  useEffect(() => {
    setUsageHistory([]);
  }, [selectedServer]);

  // Handle WebSocket subscriptions
  useEffect(() => {
    if (isConnected && selectedServer) {
      const topic = `resource-monitor:${selectedServer}`;
      subscribe(topic);

      // Perform an initial fetch of the status when we connect or switch servers
      fetchStatus();
      return () => {
        unsubscribe(topic);
      };
    }
  }, [isConnected, selectedServer, subscribe, unsubscribe, fetchStatus]);

  // Direct listeners preserve every log frame even when React batches renders.
  useEffect(() => {
    if (!selectedServer) return;
    return addMessageListener((lastMessage) => {
      const resourceTopic = `resource-monitor:${selectedServer}`;
      if (
        lastMessage.topic === resourceTopic &&
        lastMessage.type === "resource_update"
      ) {
        const info = lastMessage.data?.process_info;
        if (info) {
          setUsageHistory((prev) => {
            const newPoint = {
              time: new Date().toLocaleTimeString(),
              cpu: info.cpu_percent || 0,
              memory: info.memory_mb || 0,
            };
            // Limit history
            const newData = [...prev, newPoint];
            if (newData.length > 20) newData.shift();
            return newData;
          });
        }
      }
    });
  }, [addMessageListener, selectedServer]);
  const write = useResourceMutation(
    ({ id, options }, { session }) =>
      callOperation(id, { ...options, session }),
    [queryKeys.servers(), queryKeys.serverMonitor(selectedServer)],
  );
  /** @type {typeof callOperation} */
  const writeOperation = (id, ...args) =>
    write.mutateAsync({ id, options: args[0] });

  const loadingAction = write.isPending;

  const handleCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    if (!selectedServer) return;
    logger.info(`[Monitor] Sending command`, {
      server: selectedServer,
      command: command.trim(),
    });

    try {
      await writeOperation("send_command", {
        path: { server_name: selectedServer },
        body: {
          command: command.trim(),
        },
      });
      addToast("Command sent successfully.", "success");
      setCommand("");
    } catch (error) {
      logger.error(`[Monitor] Command failed`, {
        error,
        server: selectedServer,
        command: command.trim(),
      });
      addToast(error.message || "Failed to send command.", "error");
    }
  };
  /** @param {"start" | "stop" | "restart"} action */
  const sendAction = async (action) => {
    if (loadingAction || !selectedServer) return;
    logger.info(`[Monitor] Sending signal`, {
      action,
      server: selectedServer,
    });

    addToast(`Requesting server ${action}...`, "info");
    try {
      const response = await writeOperation(
        /** @type {const} */ ({
          start: "start_server",
          stop: "stop_server",
          restart: "restart_server",
        })[action],
        { path: { server_name: selectedServer } },
      );
      addToast(response?.message || "Server action completed.", "success");
    } catch (error) {
      logger.error(`[Monitor] Action failed`, {
        error,
        action,
        server: selectedServer,
      });
      addToast(error.message || `Failed to ${action} server.`, "error");
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
          Please select a server from the sidebar to view its monitor.
        </div>
      </div>
    );
  }
  const isRunning = Boolean(processInfo?.pid);
  const server = servers.find((item) => item.name === selectedServer);
  const status = isRunning
    ? "RUNNING"
    : String(server?.status ?? "unknown").toUpperCase();
  const metrics = [
    ["PID", processInfo?.pid ?? "—"],
    ["Uptime", processInfo?.uptime ?? "—"],
    [
      "CPU",
      processInfo?.cpu_percent != null
        ? `${processInfo.cpu_percent.toFixed(1)}%`
        : "—",
    ],
    [
      "Memory",
      processInfo?.memory_mb != null
        ? `${processInfo.memory_mb.toFixed(1)} MB`
        : "—",
    ],
    ["Players", server?.player_count ?? "—"],
  ];
  return (
    <div className="container monitor-page">
      <QueryStatus query={monitorQuery} />
      <div className="monitor-heading">
        <div>
          <h1>Server Monitor: {selectedServer}</h1>
          <div className="monitor-state">
            <span
              className={`status-indicator ${isRunning ? "status-running" : "status-stopped"}`}
            >
              {status}
            </span>
            <span className="monitor-connection">
              {isConnected
                ? "Live updates"
                : isFallback
                  ? "Polling mode"
                  : "Disconnected"}
            </span>
          </div>
        </div>
        <div className="monitor-actions" aria-label="Server controls">
          <button
            type="button"
            className="action-button start-button"
            onClick={() => sendAction("start")}
            disabled={loadingAction || isRunning}
          >
            <Play size={16} aria-hidden="true" /> Start
          </button>
          <button
            type="button"
            className="action-button danger-button"
            onClick={() => sendAction("stop")}
            disabled={loadingAction || !isRunning}
          >
            <Square size={16} aria-hidden="true" /> Stop
          </button>
          <button
            type="button"
            className="action-button warning-button"
            onClick={() => sendAction("restart")}
            disabled={loadingAction}
          >
            <RotateCcw size={16} aria-hidden="true" /> Restart
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => fetchStatus()}
            disabled={monitorQuery.isFetching}
            aria-label="Refresh server status"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <section
        className="monitor-status"
        aria-labelledby="monitor-status-title"
      >
        <h2 id="monitor-status-title">Process Status</h2>
        <dl className="monitor-metrics">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt>
                {label === "Players" && <Users size={14} aria-hidden="true" />}
                {label}
              </dt>
              <dd
                title={
                  label === "Players"
                    ? server?.players
                        ?.map((player) => player.name)
                        .join("\n") || "No players online"
                    : undefined
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {!processInfo && !monitorQuery.isPending && (
          <p className="monitor-hint">
            Server process not running or status unavailable.
          </p>
        )}
      </section>
      <div className="monitor-panels">
        <section
          className="monitor-panel monitor-resources"
          aria-labelledby="monitor-resource-title"
        >
          <div className="monitor-panel-heading">
            <h2 id="monitor-resource-title">Resource Usage</h2>
            <div className="monitor-chart-key">
              <span>CPU %</span>
              <span>RAM (MB)</span>
            </div>
          </div>
          <div className="monitor-chart" ref={chartContainerRef}>
            {chartReady && usageHistory && usageHistory.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={10}
                minHeight={10}
              >
                <LineChart data={usageHistory}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis dataKey="time" hide />
                  <YAxis
                    yAxisId="left"
                    domain={[0, 100]}
                    stroke="var(--text-color-secondary)"
                    width={40}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--bsm-chart-2)"
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bsm-surface-raised)",
                      border: "1px solid var(--border-color)",
                    }}
                    labelStyle={{
                      color: "var(--text-color-secondary)",
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cpu"
                    stroke="var(--bsm-chart-1)"
                    name="CPU %"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="memory"
                    stroke="var(--bsm-chart-2)"
                    name="RAM (MB)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "var(--text-color-secondary)",
                }}
              >
                Waiting for resource data...
              </div>
            )}
          </div>
          <p className="monitor-hint">
            Recent samples · CPU on the left, memory on the right
          </p>
        </section>
        <section
          className="monitor-panel monitor-console"
          aria-labelledby="monitor-log-title"
        >
          <div className="monitor-panel-heading">
            <h2 id="monitor-log-title">
              <FileText size={18} aria-hidden="true" /> Server Log
            </h2>
          </div>
          <LogViewer
            topic={`server_log:${selectedServer}`}
            label="Server log output"
            style={{
              height: "360px",
              fontSize: "0.85rem",
              borderRadius: "8px",
            }}
          />
          <form className="monitor-command" onSubmit={handleCommand}>
            <div className="monitor-command-input">
              <Terminal size={18} aria-hidden="true" />
              <input
                type="text"
                className="form-input"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder={
                  isRunning
                    ? "Enter command..."
                    : "Start the server to send commands"
                }
                aria-label="Console command"
                disabled={loadingAction || !isRunning}
              />
            </div>
            <button
              type="submit"
              className="action-button"
              disabled={loadingAction || !command.trim() || !isRunning}
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
export default Monitor;
