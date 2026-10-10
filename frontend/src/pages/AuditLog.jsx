import { useResourceQuery } from "../app/resourceQueries";
import React, { useState } from "react";
import LogViewer from "../components/LogViewer";
import QueryStatus from "../components/QueryStatus";
import { useToast } from "../ToastContext";
import { RefreshCw, Activity, User, FileText } from "lucide-react";
const AuditLog = () => {
  const [activeTab, setActiveTab] = useState("users");
  const logsQuery = useResourceQuery("audit", undefined, {
    enabled: activeTab === "users",
  });
  const tasksQuery = useResourceQuery("tasks", undefined, {
    enabled: activeTab === "tasks",
  });
  const logs = logsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const loading =
    activeTab === "users" ? logsQuery.isFetching : tasksQuery.isFetching;

  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const { addToast } = useToast();
  const fetchLogs = async () => (await logsQuery.refetch()).isSuccess;
  const fetchTasks = async () => (await tasksQuery.refetch()).isSuccess;
  const handleRefresh = async () => {
    if (activeTab === "users") {
      const success = await fetchLogs();
      if (success) addToast("Audit logs refreshed", "success");
    } else if (activeTab === "tasks") {
      const success = await fetchTasks();
      if (success) addToast("Tasks list refreshed", "success");
    } else if (activeTab === "app_log") {
      setLogRefreshKey((key) => key + 1);
    }
  };
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };
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
        <h1
          style={{
            margin: 0,
          }}
        >
          System Logs & Tasks
        </h1>
        <button
          className="action-button secondary"
          onClick={handleRefresh}
          disabled={loading && activeTab !== "app_log"}
          type="button"
        >
          <RefreshCw
            size={16}
            style={{
              marginRight: "5px",
            }}
            className={loading ? "spin" : ""}
          />
          {activeTab === "app_log" ? "Clear" : "Refresh"}
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
          type="button"
          aria-pressed={activeTab === "users"}
        >
          <User
            size={16}
            style={{
              marginRight: "5px",
            }}
          />{" "}
          User Actions
        </button>
        <button
          className={`tab-button ${activeTab === "app_log" ? "active" : ""}`}
          onClick={() => setActiveTab("app_log")}
          type="button"
          aria-pressed={activeTab === "app_log"}
        >
          <FileText
            size={16}
            style={{
              marginRight: "5px",
            }}
          />{" "}
          App Log
        </button>
        <button
          className={`tab-button ${activeTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveTab("tasks")}
          type="button"
          aria-pressed={activeTab === "tasks"}
        >
          <Activity
            size={16}
            style={{
              marginRight: "5px",
            }}
          />{" "}
          Background Tasks
        </button>
      </div>

      <div className="tab-content">
        {activeTab !== "app_log" && (
          <QueryStatus query={activeTab === "users" ? logsQuery : tasksQuery} />
        )}
        {activeTab === "users" && (
          <>
            {loading && logs.length === 0 ? (
              <div
                className="container"
                style={{
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Loading logs...
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table
                  className="server-table"
                  style={{
                    width: "100%",
                  }}
                >
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User ID</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div className="scrollable-field">
                            {formatDate(log.timestamp)}
                          </div>
                        </td>
                        <td>
                          <div className="scrollable-field">{log.user_id}</div>
                        </td>
                        <td>
                          <div className="scrollable-field">
                            <span className="badge badge-user">
                              {log.action}
                            </span>
                          </div>
                        </td>
                        <td>
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              maxHeight: "100px",
                              overflowY: "auto",
                              background: "rgba(0,0,0,0.1)",
                              padding: "5px",
                              borderRadius: "4px",
                              fontSize: "0.85em",
                            }}
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "var(--text-color-secondary)",
                          }}
                        >
                          No user audit logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "app_log" && (
          <LogViewer
            topic="app_log"
            label="Application log output"
            emptyMessage="Waiting for application logs..."
            refreshKey={logRefreshKey}
            style={{
              height: "calc(100vh - 250px)",
              minHeight: "400px",
              fontSize: "0.9em",
              borderRadius: "5px",
              border: "1px solid var(--border-color)",
            }}
          />
        )}

        {activeTab === "tasks" && (
          <>
            {loading && tasks.length === 0 ? (
              <div
                className="container"
                style={{
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Loading tasks...
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table
                  className="server-table"
                  style={{
                    width: "100%",
                  }}
                >
                  <thead>
                    <tr>
                      <th>Task ID</th>
                      <th>Status</th>
                      <th>Message</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td
                          style={{
                            fontSize: "0.85em",
                            fontFamily: "monospace",
                          }}
                        >
                          <div className="scrollable-field">{task.id}</div>
                        </td>
                        <td>
                          <div className="scrollable-field">
                            <span
                              className={`status-indicator ${task.status === "completed" ? "status-running" : ["failed", "cancelled"].includes(task.status) ? "status-stopped" : "status-starting"}`}
                            >
                              {task.status.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="scrollable-field">{task.message}</div>
                        </td>
                        <td>
                          {task.error || task.result ? (
                            <pre
                              style={{
                                margin: 0,
                                maxHeight: "50px",
                                overflowY: "auto",
                                fontSize: "0.85em",
                              }}
                            >
                              {task.error?.message ??
                                JSON.stringify(task.result)}
                            </pre>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "var(--text-color-secondary)",
                          }}
                        >
                          No background tasks found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default AuditLog;
