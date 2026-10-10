import LogViewer from "../components/LogViewer";
import { queryKeys } from "../app/queryKeys";
import QueryStatus from "../components/QueryStatus";
import { useResourceQuery, useResourceMutation } from "../app/resourceQueries";
import React, { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../WebSocketContext";
import { useServer } from "../ServerContext";
import { useToast } from "../ToastContext";
import { post } from "../api";
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
    ({ method, url, body }) => {
      if (method === "post")
        return body === undefined ? post(url) : post(url, body);
    },
    [queryKeys.servers(), queryKeys.serverMonitor(selectedServer)],
  );

  const loadingAction = write.isPending;
  const writePost = (url, body) =>
    write.mutateAsync({ url, body, method: "post" });
  const handleCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    if (!selectedServer) return;
    logger.info(`[Monitor] Sending command`, {
      server: selectedServer,
      command: command.trim(),
    });

    try {
      await writePost(`/api/server/${selectedServer}/send_command`, {
        command: command.trim(),
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
  const sendAction = async (action) => {
    if (loadingAction || !selectedServer) return;
    logger.info(`[Monitor] Sending signal`, {
      action,
      server: selectedServer,
    });

    addToast(`Requesting server ${action}...`, "info");
    try {
      const response = await writePost(
        `/api/server/${selectedServer}/${action}`,
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
  const isRunning = processInfo && processInfo.pid;
  return (
    <div className="container">
      <QueryStatus query={monitorQuery} />
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Server Monitor: {selectedServer}</h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            className={`status-text ${isConnected ? "status-running" : "status-stopped"}`}
            style={{
              fontWeight: "bold",
              color: isConnected ? "lightgreen" : "red",
            }}
          >
            {isConnected ? "• Live" : "• Disconnected"}
          </span>
          {isFallback && (
            <span
              style={{
                fontSize: "0.8em",
                color: "orange",
                fontStyle: "italic",
              }}
            >
              (Polling Mode)
            </span>
          )}
        </div>
      </div>

      <div
        className="grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* Status Panel */}
        <div
          style={{
            background: "var(--container-background-color, #444)",
            padding: "20px",
            border: "1px solid var(--border-color, #555)",
          }}
        >
          <h3>Process Status</h3>
          {processInfo ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                fontSize: "0.9em",
              }}
            >
              <div>
                <strong>PID:</strong> {processInfo.pid ?? "N/A"}
              </div>
              <div>
                <strong>Uptime:</strong> {processInfo.uptime ?? "N/A"}
              </div>
              <div>
                <strong>CPU:</strong>{" "}
                {processInfo.cpu_percent != null
                  ? processInfo.cpu_percent.toFixed(1) + "%"
                  : "N/A"}
              </div>
              <div>
                <strong>Memory:</strong>{" "}
                {processInfo.memory_mb != null
                  ? processInfo.memory_mb.toFixed(1) + " MB"
                  : "N/A"}
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  marginTop: "10px",
                }}
              >
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    color: processInfo.pid ? "lightgreen" : "red",
                    fontWeight: "bold",
                  }}
                >
                  {processInfo.pid ? "RUNNING" : "STOPPED"}
                </span>
              </div>

              {/* Online Players Tooltip inside Monitor */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  marginTop: "10px",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Users size={14} /> <strong>Players:</strong>{" "}
                  <span
                    style={{
                      color: "var(--text-color)",
                      position: "relative",
                      cursor: "help",
                    }}
                    title={(() => {
                      const currentServerObj = servers.find(
                        (s) => s.name === selectedServer,
                      );
                      const players = currentServerObj?.players || [];
                      return players.length > 0
                        ? players.map((p) => p.name).join("\n")
                        : "No players online";
                    })()}
                  >
                    {(() => {
                      const currentServerObj = servers.find(
                        (s) => s.name === selectedServer,
                      );
                      return currentServerObj?.player_count !== undefined
                        ? currentServerObj.player_count
                        : "-";
                    })()}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                color: "var(--text-color-secondary)",
                fontStyle: "italic",
              }}
            >
              Server process not running or status unavailable.
            </div>
          )}
        </div>

        {/* Chart Panel */}
        <div
          style={{
            background: "var(--container-background-color, #444)",
            padding: "20px",
            border: "1px solid var(--border-color, #555)",
            minHeight: "250px",
          }}
        >
          <h3>Resource Usage</h3>
          {/* Fixed dimensions container for ResponsiveContainer to calculate from */}
          <div
            ref={chartContainerRef}
            style={{
              height: "200px",
              width: "100%",
              minHeight: "200px",
              position: "relative",
            }}
          >
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
        </div>
      </div>

      <div
        className="grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        {/* Controls (Half Card) */}
        <div
          className="controls-section"
          style={{
            background: "var(--container-background-color, #444)",
            padding: "20px",
            border: "1px solid var(--border-color, #555)",
          }}
        >
          <h3>Quick Actions</h3>
          <div
            className="button-group"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                className="action-button start-button"
                onClick={() => sendAction("start")}
                disabled={loadingAction || isRunning}
                style={{
                  flex: 1,
                  justifyContent: "center",
                }}
                type="button"
              >
                <Play
                  size={16}
                  style={{
                    marginRight: "5px",
                  }}
                />{" "}
                Start
              </button>
              <button
                className="action-button danger-button"
                onClick={() => sendAction("stop")}
                disabled={loadingAction || !isRunning}
                style={{
                  flex: 1,
                  justifyContent: "center",
                }}
                type="button"
              >
                <Square
                  size={16}
                  style={{
                    marginRight: "5px",
                  }}
                />{" "}
                Stop
              </button>
            </div>
            <button
              className="action-button warning-button"
              onClick={() => sendAction("restart")}
              disabled={loadingAction}
              style={{
                width: "100%",
                justifyContent: "center",
              }}
              type="button"
            >
              <RotateCcw
                size={16}
                style={{
                  marginRight: "5px",
                }}
              />{" "}
              Restart
            </button>
          </div>
        </div>

        {/* Server Log Stream (Half Card) */}
        <div
          style={{
            background: "var(--container-background-color, #444)",
            padding: "20px",
            border: "1px solid var(--border-color, #555)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <FileText size={18} /> Server Log
          </h3>
          <LogViewer
            topic={`server_log:${selectedServer}`}
            label="Server log output"
            style={{ height: "150px", fontSize: "0.85em", borderRadius: "4px" }}
          />
        </div>
      </div>

      {/* Command Console */}
      <div
        className="console-section"
        style={{
          background: "var(--container-background-color, #444)",
          padding: "20px",
          border: "1px solid var(--border-color, #555)",
        }}
      >
        <h3>Send Command</h3>
        <form
          onSubmit={handleCommand}
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <div
            style={{
              flexGrow: 1,
              position: "relative",
            }}
          >
            <Terminal
              size={18}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-color-secondary)",
              }}
            />
            <input
              type="text"
              className="form-input"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter command..."
              aria-label="Console command"
              style={{
                width: "100%",
                paddingLeft: "35px",
              }}
              disabled={loadingAction || !isRunning}
            />
          </div>
          <button
            type="submit"
            className="action-button"
            disabled={loadingAction || !command || !isRunning}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
export default Monitor;
