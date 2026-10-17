import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getPreferenceIdentity } from "../app/backendIdentity";
import { usePreference } from "../app/usePreference";
import { browserRecords } from "../app/browserRecords";
export default function RecoverySettings() {
  const { user } = useAuth();
  const scope = getPreferenceIdentity(user);
  const [enabled, setEnabled] = usePreference("draftRecovery", false);
  const [notice, setNotice] = useState(null);
  return (
    <section className="settings-panel" aria-labelledby="recovery-title">
      <h2 id="recovery-title">Browser recovery</h2>
      <p>
        Basic fleet details are cached for up to 24 hours for read-only viewing
        when the backend is unreachable. Cached information is always marked as
        stale.
      </p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            if (!event.target.checked)
              void browserRecords.clear(scope, "draft");
          }}
        />{" "}
        Recover unsaved settings and properties
      </label>
      <p className="form-help-text">
        Stores recognized, non-sensitive fields in this browser for up to 7
        days. Restore edits explicitly after reloading. Passwords, secrets,
        custom fields, plugin settings and raw files are excluded. Nothing is
        saved to the server automatically.
      </p>
      <button
        type="button"
        className="action-button secondary"
        onClick={async () => {
          const cleared = await browserRecords.clear(scope);
          setNotice({
            scope,
            message: cleared
              ? "Cached views and saved edits cleared."
              : "Browser storage is unavailable.",
          });
        }}
      >
        Clear cached views and saved edits
      </button>
      {notice?.scope === scope && <p role="status">{notice.message}</p>}
    </section>
  );
}
