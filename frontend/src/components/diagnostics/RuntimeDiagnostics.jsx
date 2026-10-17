import { useSyncExternalStore } from "react";
import { application } from "../../app/application";
export default function RuntimeDiagnostics() {
  const diagnostics = application.diagnostics;
  const snapshot = useSyncExternalStore(
    diagnostics.subscribe,
    diagnostics.getSnapshot,
  );
  return (
    <details className="settings-panel">
      <summary>Frontend runtime diagnostics</summary>
      <p>
        {snapshot.subscriptions} active subscription topics ·{" "}
        {snapshot.references} references
      </p>
      <label>
        <input
          type="checkbox"
          checked={snapshot.enabled}
          onChange={(event) => diagnostics.setEnabled(event.target.checked)}
        />{" "}
        Record frontend observations
      </label>
      <p>
        Up to 200 observations in memory. No request bodies, credentials,
        identities, resource names or payload values are recorded.
      </p>
      <button
        className="action-button secondary"
        type="button"
        onClick={() => diagnostics.clear()}
      >
        Clear observations
      </button>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Observation</th>
              <th>Reason</th>
              <th>Resource family</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.events.map((event, index) => (
              <tr key={index}>
                <td>{new Date(event.at).toLocaleTimeString()}</td>
                <td>{event.type}</td>
                <td>{event.reason ?? "—"}</td>
                <td>{event.family ?? "—"}</td>
                <td>{event.count ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!snapshot.events.length && <p>No observations recorded.</p>}
    </details>
  );
}
