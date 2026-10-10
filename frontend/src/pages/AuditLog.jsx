import { useResourceQuery } from "../app/resourceQueries";
import React, { useState } from "react";
import TaskOutcome from "../components/TaskOutcome";
import LogViewer from "../components/LogViewer";
import QueryStatus from "../components/QueryStatus";
import { useToast } from "../contexts/ToastContext";
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
              <div className="task-history">
                {logs.map((log) => (
                  <article
                    className="task-history-card"
                    key={log.id}
                    aria-label={`Audit event ${log.action}`}
                  >
                    <header>
                      <strong>{log.action}</strong>
                      <time dateTime={log.timestamp}>
                        {formatDate(log.timestamp)}
                      </time>
                    </header>
                    <p>User ID: {log.user_id ?? "System"}</p>
                    <TaskOutcome
                      result={log.details}
                      rawLabel="View event details"
                    />
                  </article>
                ))}
                {logs.length === 0 && <p>No user audit logs found.</p>}
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
              <div className="task-history">
                {tasks.map((task) => (
                  <article
                    className="task-history-card"
                    key={task.id}
                    aria-label={`Task ${task.id}`}
                  >
                    <header>
                      <code>{task.id}</code>
                      <span
                        className={`status-indicator ${task.status === "completed" ? "status-running" : ["failed", "cancelled"].includes(task.status) ? "status-stopped" : "status-starting"}`}
                      >
                        {task.status.toUpperCase()}
                      </span>
                    </header>
                    <p>{task.message}</p>
                    <TaskOutcome result={task.result} error={task.error} />
                  </article>
                ))}
                {tasks.length === 0 && <p>No background tasks found.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default AuditLog;
