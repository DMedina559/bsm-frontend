import { useResourceQuery } from "../app/resourceQueries";
import { useServerInstallation } from "../features/servers/useServerInstallation";
import React, { useState, useCallback } from "react";
import { useToast } from "../contexts/ToastContext";
import { useServer } from "../contexts/ServerContext";
import { useNavigate } from "react-router-dom";
import { PlusSquare, RefreshCw } from "lucide-react";
const ServerInstall = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { refreshServers, setSelectedServer } = useServer();
  const onInstalled = useCallback(
    async (name, assertCurrent) => {
      await refreshServers();
      assertCurrent();
      setSelectedServer(name);
      navigate("/server-properties", { state: { setupFlow: true } });
    },
    [navigate, refreshServers, setSelectedServer],
  );
  const installation = useServerInstallation(onInstalled);
  const loading = installation.loading;
  const [formData, setFormData] = useState({
    server_name: installation.serverName ?? "",
    server_version: "LATEST",
    server_zip_path: "",
    overwrite: false,
  });
  const [specificVersion, setSpecificVersion] = useState("");
  const downloadsQuery = useResourceQuery("downloads");
  const customZips = downloadsQuery.data ?? [];
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (!formData.server_name.trim()) {
      addToast("Server name is required", "error");
      return;
    }
    if (formData.server_version === "SPECIFIC" && !specificVersion) {
      addToast("Please enter a specific version number.", "error");
      return;
    }
    await installation.submit({
      ...formData,
      server_version:
        formData.server_version === "SPECIFIC"
          ? specificVersion.trim()
          : formData.server_version,
    });
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
          padding: "calc(30px * var(--bsm-spacing-scale))",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
        }}
      >
        <form onSubmit={handleSubmit} className="form-group">
          <div
            style={{
              marginBottom: "calc(20px * var(--bsm-spacing-scale))",
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
              marginBottom: "calc(20px * var(--bsm-spacing-scale))",
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
                marginBottom: "calc(20px * var(--bsm-spacing-scale))",
                padding: "calc(15px * var(--bsm-spacing-scale))",
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
                marginBottom: "calc(20px * var(--bsm-spacing-scale))",
                padding: "calc(15px * var(--bsm-spacing-scale))",
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
              marginBottom: "calc(30px * var(--bsm-spacing-scale))",
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
                  marginRight: "calc(10px * var(--bsm-spacing-scale))",
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
                  marginRight: "calc(8px * var(--bsm-spacing-scale))",
                }}
              />
            ) : (
              <PlusSquare
                size={20}
                style={{
                  marginRight: "calc(8px * var(--bsm-spacing-scale))",
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
