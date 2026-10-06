import React from "react";
export default function SettingsField({
  path,
  label,
  value,
  onChange,
  readOnly = false,
}) {
  const [numeric] = React.useState(() => typeof value === "number");
  const id = `setting-${path}`;
  const helpId = `${id}-help`;
  return (
    <div className="setting-item">
      <label htmlFor={id} className="form-label">
        {label || path.split(".").at(-1).replace(/_/g, " ")}
      </label>
      {typeof value === "boolean" ? (
        <select
          id={id}
          className="form-input"
          value={String(value)}
          onChange={(event) => onChange(path, event.target.value === "true")}
          disabled={readOnly}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      ) : (
        <input
          id={id}
          className="form-input"
          type={numeric ? "number" : "text"}
          step={numeric ? "any" : undefined}
          required={numeric}
          value={Array.isArray(value) ? value.join(", ") : (value ?? "")}
          readOnly={readOnly}
          aria-describedby={
            Array.isArray(value) || readOnly ? helpId : undefined
          }
          onChange={(event) =>
            onChange(
              path,
              Array.isArray(value)
                ? event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                : numeric && event.target.value !== ""
                  ? Number(event.target.value)
                  : event.target.value,
            )
          }
        />
      )}
      {(Array.isArray(value) || readOnly) && (
        <small className="form-help-text" id={helpId}>
          {readOnly
            ? "Reported by the server. This field is read only."
            : "Comma-separated values."}
        </small>
      )}
    </div>
  );
}
