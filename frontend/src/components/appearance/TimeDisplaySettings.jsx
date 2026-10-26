import { usePreference } from "../../app/usePreference";
import { useTimeFormat } from "../../app/useTimeFormat";
export default function TimeDisplaySettings() {
  const [mode, setMode] = usePreference("timeDisplay", "application");
  const { timezone } = useTimeFormat();
  return (
    <section className="settings-panel" aria-labelledby="time-display-title">
      <div className="section-heading">
        <div>
          <h2 id="time-display-title">Dates and times</h2>
          <p>Choose how timestamps appear on this account and browser.</p>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="time-display">
          Display timezone
        </label>
        <select
          className="form-input"
          id="time-display"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="application">Application timezone</option>
          <option value="local">My timezone</option>
          <option value="utc">UTC</option>
        </select>
        <small className="form-help-text">
          Currently displaying {timezone}. Timestamp details include the exact
          UTC instant. Schedule times and raw logs keep their own timezone.
        </small>
      </div>
    </section>
  );
}
