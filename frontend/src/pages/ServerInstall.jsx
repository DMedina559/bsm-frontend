import { useDialog } from "../DialogContext";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../ToastContext";
import { post, get } from "../api";
import { useServer } from "../ServerContext";
import { useNavigate } from "react-router-dom";
import { PlusSquare, RefreshCw } from "lucide-react";
import { useWebSocket } from "../WebSocketContext";
import { logger } from "../utils/logger";
const ServerInstall = () => {
  const { confirmAction } = useDialog();
  const [formData, setFormData] = useState({
    server_name: "",
    server_version: "LATEST",
    server_zip_path: "",
    overwrite: false,
  });
  const [specificVersion, setSpecificVersion] = useState("");
  const [customZips, setCustomZips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [installTaskId, setInstallTaskId] = useState(null);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { refreshServers, setSelectedServer } = useServer();
  const { subscribe, unsubscribe, addMessageListener } = useWebSocket();
  const handledTask = useRef(null);

  const handleInstallSuccess = useCallback(async () => {
    await refreshServers();
    setSelectedServer(formData.server_name);
    if (installTaskId) {
      unsubscribe(`task:${installTaskId}`);
    }
    setLoading(false);
    navigate("/server-properties", {
      state: {
        setupFlow: true,
      },
    });
  }, [
    formData.server_name,
    installTaskId,
    navigate,
    refreshServers,
    setSelectedServer,
    unsubscribe,
  ]);
  useEffect(() => {
    const fetchCustomZips = async () => {
      try {
        const data = await get("/api/downloads/list");
        if (data && data.status === "success") {
          setCustomZips(data.custom_zips || []);
        }
      } catch (error) {
        logger.warn("[ServerInstall] Failed to fetch custom zips", {
          error,
        });
      }
    };
    fetchCustomZips();
  }, []);

  const handleTaskUpdate = useCallback(
    (taskData) => {
      if (!installTaskId || handledTask.current === installTaskId) return;
      const completed = ["completed", "success"].includes(taskData.status);
      const failed = ["failed", "cancelled", "error"].includes(taskData.status);
      if (!completed && !failed) return;

      handledTask.current = installTaskId;
      setInstallTaskId(null);
      unsubscribe(`task:${installTaskId}`);
      if (
        completed &&
        !["error", "skipped"].includes(taskData.result?.status)
      ) {
        addToast("Installation completed successfully!", "success");
        handleInstallSuccess();
      } else {
        addToast(
          `Installation failed: ${taskData.error?.message || taskData.result?.message || taskData.message}`,
          "error",
        );
        setLoading(false);
      }
    },
    [installTaskId, unsubscribe, addToast, handleInstallSuccess],
  );

  // Listen directly so another topic cannot overwrite completion in a React batch.
  useEffect(() => {
    if (!installTaskId) return;
    const topic = `task:${installTaskId}`;
    const removeListener = addMessageListener((message) => {
      if (message.topic === topic && message.type === "task_update") {
        handleTaskUpdate(message.data);
      }
    });
    subscribe(topic);
    return () => {
      removeListener();
      unsubscribe(topic);
    };
  }, [
    installTaskId,
    addMessageListener,
    subscribe,
    unsubscribe,
    handleTaskUpdate,
  ]);

  // Reconcile even with an active socket: completion may precede subscription
  // or occur during reconnection. The same handler makes delivery idempotent.
  useEffect(() => {
    if (!installTaskId) return;
    let disposed = false;
    let polling = false;
    const pollStatus = async () => {
      if (polling) return;
      polling = true;
      try {
        const taskData = await get(`/api/tasks/status/${installTaskId}`);
        if (!disposed && taskData) handleTaskUpdate(taskData);
      } catch (error) {
        logger.warn("[ServerInstall] Polling task status failed", {
          error,
          installTaskId,
        });
        if (!disposed && error.status === 404) {
          handleTaskUpdate({
            status: "failed",
            message: "Installation task lost.",
          });
        }
      } finally {
        polling = false;
      }
    };
    const intervalId = setInterval(pollStatus, 2000);
    pollStatus();
    return () => {
      disposed = true;
      clearInterval(intervalId);
    };
  }, [installTaskId, handleTaskUpdate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!formData.server_name.trim()) {
      addToast("Server name is required", "error");
      return;
    }
    if (formData.server_version === "SPECIFIC" && !specificVersion) {
      addToast("Please enter a specific version number.", "error");
      return;
    }
    const payload = {
      ...formData,
    };
    if (formData.server_version === "SPECIFIC") {
      payload.server_version = specificVersion.trim();
    }
    setLoading(true);
    try {
      const response = await post("/api/server/install", payload);
      const initiateMonitoring = (taskId) => {
        setInstallTaskId(taskId);
        handledTask.current = null;
        addToast("Installation started. Please wait...", "info");
      };
      if (response && response.status === "confirm_needed") {
        if (await confirmAction(response.message)) {
          const confirmData = {
            ...payload,
            overwrite: true,
          };
          const confirmResponse = await post(
            "/api/server/install",
            confirmData,
          );
          if (confirmResponse && confirmResponse.task_id) {
            initiateMonitoring(confirmResponse.task_id);
          } else {
            addToast(
              "The installation did not return a task ID. Try again.",
              "error",
            );
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } else if (response && response.task_id) {
        initiateMonitoring(response.task_id);
      } else {
        addToast("Failed to start installation task.", "error");
        setLoading(false);
      }
    } catch (error) {
      addToast(error.message || "Failed to install server.", "error");
      setLoading(false);
    }
  };
  return (
    <div className="container">
      <div className="header">
        <h1>Install New Server</h1>
      </div>

      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          background: "var(--container-background-color)",
          padding: "30px",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
        }}
      >
        <form onSubmit={handleSubmit} className="form-group">
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label className="form-label" htmlFor="server_name">
              Server Name
            </label>
            <input
              type="text"
              id="server_name"
              name="server_name"
              className="form-input"
              value={formData.server_name}
              onChange={handleChange}
              placeholder="MyBedrockServer"
              required
              pattern="^[a-zA-Z0-9_\-]+$"
              title="Letters, numbers, underscores, and hyphens only."
              disabled={loading}
            />
            <small
              style={{
                color: "var(--text-color-secondary)",
              }}
            >
              Unique name for the server instance.
            </small>
          </div>

          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <label className="form-label" htmlFor="server_version">
              Server Version
            </label>
            <select
              id="server_version"
              name="server_version"
              className="form-input"
              value={formData.server_version}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="LATEST">LATEST (Stable)</option>
              <option value="PREVIEW">PREVIEW (Beta)</option>
              <option value="CUSTOM">CUSTOM (Use uploaded ZIP)</option>
              <option value="SPECIFIC">
                SPECIFIC VERSION (Enter manually)
              </option>
            </select>
          </div>

          {formData.server_version === "SPECIFIC" && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                background: "var(--text-color)",
                border: "1px solid var(--border-color)",
                borderRadius: "5px",
              }}
            >
              <label className="form-label" htmlFor="specificVersion">
                Enter Version Number
              </label>
              <input
                type="text"
                id="specificVersion"
                className="form-input"
                value={specificVersion}
                onChange={(e) => setSpecificVersion(e.target.value)}
                placeholder="e.g., 1.21.114.1 or 1.21.130.22-preview"
                required
                disabled={loading}
              />
              <small
                style={{
                  color: "var(--text-color-secondary)",
                }}
              >
                Must be a valid version number available from Mojang.
              </small>
            </div>
          )}

          {formData.server_version === "CUSTOM" && (
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                background: "var(--text-color)",
                border: "1px solid var(--border-color)",
                borderRadius: "5px",
              }}
            >
              <label className="form-label" htmlFor="server_zip_path">
                Select Custom ZIP
              </label>
              {customZips.length > 0 ? (
                <select
                  id="server_zip_path"
                  name="server_zip_path"
                  className="form-input"
                  value={formData.server_zip_path}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="">-- Select ZIP File --</option>
                  {customZips.map((zip) => (
                    <option key={zip} value={zip}>
                      {zip}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  style={{
                    color: "red",
                  }}
                >
                  No custom ZIP files found in <code>downloads/custom/</code>.
                  Please upload one first.
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginBottom: "30px",
            }}
          >
            <label
              className="form-label"
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                name="overwrite"
                checked={formData.overwrite}
                onChange={handleChange}
                style={{
                  marginRight: "10px",
                }}
                disabled={loading}
              />
              Overwrite existing server if name conflicts?
            </label>
          </div>

          <button
            type="submit"
            className="action-button"
            disabled={loading}
            style={{
              width: "100%",
              justifyContent: "center",
            }}
          >
            {loading ? (
              <RefreshCw
                className="spin"
                size={20}
                style={{
                  marginRight: "8px",
                }}
              />
            ) : (
              <PlusSquare
                size={20}
                style={{
                  marginRight: "8px",
                }}
              />
            )}
            {loading ? "Installing..." : "Install Server"}
          </button>
        </form>
      </div>
    </div>
  );
};
export default ServerInstall;
