import { localSettings, sessionSettings } from "../app/browserStorage";
import React, { useState } from "react";
import {
  getApiBaseUrl,
  setApiBaseUrl,
  validateBackendUrl,
} from "../api/transport";
import Modal from "./Modal";
import { useDialog } from "../contexts/DialogContext";
const RemoteConfigModal = ({ isOpen, onClose }) => {
  const [remoteUrl, setRemoteUrl] = useState(
    getApiBaseUrl() || import.meta.env.VITE_API_URL || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const { confirmAction } = useDialog();
  const apply = (value) => {
    setApiBaseUrl(value);
    // A different backend must not receive the previous backend's bearer token.
    localSettings.removeItem("access_token");
    sessionSettings.removeItem("access_token");
    localSettings.removeItem("selectedServer");
    setIsSaving(true);
    window.location.reload();
  };
  const handleSave = (event) => {
    event.preventDefault();
    setError(null);
    const value = remoteUrl.trim();
    if (value) {
      try {
        apply(validateBackendUrl(value));
      } catch (error) {
        setError(error.message || "Invalid backend URL.");
      }
    } else apply("");
  };
  const handleReset = async () => {
    if (
      await confirmAction(
        "Reset to the configured default backend and sign in again?",
      )
    )
      apply("");
  };
  return (
    <Modal
      isOpen={isOpen}
      title="Server Connection"
      onClose={onClose}
      closeDisabled={isSaving}
    >
      <p className="form-help-text">
        Connect to your Bedrock Server Manager backend. Changing it signs you
        out of this browser session.
      </p>
      <form onSubmit={handleSave}>
        <div className="form-group">
          <label htmlFor="remote-url-input" className="form-label">
            Backend URL
          </label>
          <input
            id="remote-url-input"
            className="form-input"
            type="url"
            value={remoteUrl}
            onChange={(event) => setRemoteUrl(event.target.value)}
            placeholder="http://192.168.1.100:11325"
            disabled={isSaving}
            aria-invalid={!!error}
            aria-describedby={error ? "remote-url-error" : undefined}
          />
        </div>
        {error && (
          <p id="remote-url-error" role="alert" className="validation-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="action-button secondary"
            onClick={handleReset}
            disabled={isSaving}
          >
            Reset to default
          </button>
          <button
            type="submit"
            className="action-button primary-button"
            disabled={isSaving}
          >
            {isSaving ? "Connecting…" : "Save connection"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
export default RemoteConfigModal;
