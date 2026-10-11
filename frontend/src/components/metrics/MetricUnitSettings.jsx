import { usePreference } from "../../app/usePreference";
import { DEFAULT_METRIC_UNITS, UNIT_OPTIONS } from "../../utils/metricUnits";
export default function MetricUnitSettings() {
  const [units, setUnits] = usePreference("metricUnits", DEFAULT_METRIC_UNITS);
  return (
    <section
      className="settings-panel metric-unit-settings"
      aria-labelledby="metric-display-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="metric-display-title">Metrics</h2>
          <p>Choose units and precision for values and charts.</p>
        </div>
      </div>
      <div className="form-grid">
        {[
          ["memory", "Memory and storage units"],
          ["rate", "Transfer rate units"],
        ].map(([key, label]) => (
          <div className="form-group" key={key}>
            <label className="form-label" htmlFor={`metric-${key}`}>
              {label}
            </label>
            <select
              className="form-input"
              id={`metric-${key}`}
              value={units[key]}
              onChange={(event) =>
                setUnits({ ...units, [key]: event.target.value })
              }
            >
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit === "auto"
                    ? "Automatic (binary units)"
                    : `${unit}${key === "rate" ? "/s" : ""}`}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="form-group">
          <label className="form-label" htmlFor="metric-duration">
            Delay units
          </label>
          <select
            className="form-input"
            id="metric-duration"
            value={units.duration}
            onChange={(event) =>
              setUnits({ ...units, duration: event.target.value })
            }
          >
            <option value="ms">Milliseconds (ms)</option>
            <option value="s">Seconds (s)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="metric-precision">
            Decimal places
          </label>
          <select
            className="form-input"
            id="metric-precision"
            value={units.precision}
            onChange={(event) =>
              setUnits({ ...units, precision: Number(event.target.value) })
            }
          >
            {[0, 1, 2, 3].map((digits) => (
              <option key={digits} value={digits}>
                {digits}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="form-help-text">
        MB/GB/TB use powers of 1000; MiB/GiB/TiB use powers of 1024.
      </p>
      <button
        type="button"
        className="action-button secondary"
        onClick={() => setUnits(DEFAULT_METRIC_UNITS)}
      >
        Reset metric display
      </button>
    </section>
  );
}
