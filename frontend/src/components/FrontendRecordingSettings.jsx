import { useSyncExternalStore } from "react";
import { runtimeHistory } from "../app/runtimeHistoryStore";
import { usePreference } from "../app/usePreference";
const defaults = { recording: false, persist: false };
export default function FrontendRecordingSettings() {
  const history = useSyncExternalStore(
    runtimeHistory.subscribe,
    runtimeHistory.getSnapshot,
  );
  const [options, setOptions] = usePreference("runtimeDiagnostics", defaults);
  return (
    <section
      className="settings-panel"
      aria-labelledby="recording-settings-title"
    >
      <h2 id="recording-settings-title">Frontend recording</h2>
      <label>
        <input
          type="checkbox"
          checked={options.recording}
          onChange={(event) =>
            setOptions({ ...options, recording: event.target.checked })
          }
        />
        Record frontend observations
      </label>
      <label>
        <input
          type="checkbox"
          checked={options.persist}
          onChange={(event) =>
            setOptions({ ...options, persist: event.target.checked })
          }
        />
        Keep history across reloads
      </label>
      <p className="form-help-text">
        Up to 1,000 observations for seven days, isolated by account and
        backend. Pausing keeps history. Disabling persistence removes the saved
        copy. Live counters describe this session only.
      </p>
      <p className="form-help-text">
        Only fixed observation types, policy reasons, resource families, times
        and counts are retained. Request bodies, credentials, identities,
        resource names and payload values are excluded.
      </p>
      {history.persistence === "unavailable" && (
        <p className="message warning" role="status">
          Browser storage is unavailable. Recording continues in memory; saved
          history may not be updated or removed.
        </p>
      )}
    </section>
  );
}
