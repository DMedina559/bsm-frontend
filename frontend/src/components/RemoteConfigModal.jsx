import React, { useState } from "react";
import { createPortal } from "react-dom";
import { getApiBaseUrl, setApiBaseUrl } from "../api";
import { Save, RotateCcw, X, Globe } from "lucide-react";

const RemoteConfigModal = ({ isOpen, onClose }) => {
  // Prefill with existing config or build-time environment variable
  const [remoteUrl, setRemoteUrl] = useState(
    getApiBaseUrl() || import.meta.env.VITE_API_URL || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setApiBaseUrl(remoteUrl);
    // Clear tokens to force re-authentication against the new server
    localStorage.removeItem("jwt_token");
    sessionStorage.removeItem("jwt_token");
    window.location.reload();
  };

  const handleReset = () => {
    if (window.confirm("Reset to default (local) backend?")) {
      setIsSaving(true);
      setApiBaseUrl("");
      // Clear tokens to force re-authentication
      localStorage.removeItem("jwt_token");
      sessionStorage.removeItem("jwt_token");
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#2a2a2a", // Fallback color
          color: "#fff", // Fallback color
          padding: "25px",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "400px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "transparent",
            border: "none",
            color: "#aaa",
            cursor: "pointer",
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Globe size={24} color="#007bff" />
          <h3 style={{ margin: 0, fontSize: "1.2em" }}>Server Connection</h3>
        </div>

        <p style={{ fontSize: "0.9em", color: "#ccc", margin: 0 }}>
          Configure the URL of your Bedrock Server Manager backend.
        </p>

        <div>
          <label
            htmlFor="remote-url-input"
            style={{
              display: "block",
              marginBottom: "5px",
              fontSize: "0.85em",
              color: "#aaa",
            }}
          >
            Backend URL
          </label>
          <input
            id="remote-url-input"
            type="text"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder="http://192.168.1.100:11325"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #444",
              backgroundColor: "#1a1a1a",
              color: "#fff",
              fontSize: "1em",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="button"
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "1px solid #444",
              color: "#ccc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "8px",
              cursor: "pointer",
              borderRadius: "4px",
            }}
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="button button-primary"
            style={{
              flex: 1,
              backgroundColor: "#007bff",
              border: "none",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "8px",
              cursor: "pointer",
              borderRadius: "4px",
            }}
          >
            <Save size={16} /> {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RemoteConfigModal;
