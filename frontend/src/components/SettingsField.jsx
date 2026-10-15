import React from "react";
import { settingField } from "../utils/settingsFields";
const parseArray = (text) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function SettingsField({
  path,
  label,
  value,
  onChange,
  readOnly = false,
}) {
  const metadata = settingField(path);
  readOnly = readOnly || metadata.readOnly;
  const [numeric] = React.useState(
    () => metadata.type === "number" || typeof value === "number",
  );
  const [arrayDraft, setArrayDraft] = React.useState(() =>
    Array.isArray(value) ? value.join(", ") : "",
  );
  React.useEffect(() => {
    if (
      Array.isArray(value) &&
      JSON.stringify(parseArray(arrayDraft)) !== JSON.stringify(value)
    ) {
      setArrayDraft(value.join(", "));
    }
  }, [value, arrayDraft]);
  const id = `setting-${path}`;
  const helpId = `${id}-help`;
  return (
    <div className="setting-item">
      <label htmlFor={id} className="form-label">
        {metadata.label || label || path.split(".").at(-1).replace(/_/g, " ")}
      </label>
      {metadata.type === "boolean" || typeof value === "boolean" ? (
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
          type={numeric ? "number" : metadata.type || "text"}
          step={numeric ? (metadata.step ?? "any") : undefined}
          min={metadata.min}
          max={metadata.max}
          required={numeric}
          value={Array.isArray(value) ? arrayDraft : (value ?? "")}
          readOnly={readOnly}
          aria-describedby={
            Array.isArray(value) ||
            readOnly ||
            metadata.description ||
            metadata.unit
              ? helpId
              : undefined
          }
          onChange={(event) => {
            if (Array.isArray(value)) {
              setArrayDraft(event.target.value);
              onChange(path, parseArray(event.target.value));
            } else {
              onChange(
                path,
                numeric && event.target.value !== ""
                  ? Number(event.target.value)
                  : event.target.value,
              );
            }
          }}
        />
      )}
      {(Array.isArray(value) ||
        readOnly ||
        metadata.description ||
        metadata.unit) && (
        <small className="form-help-text" id={helpId}>
          {readOnly
            ? "Reported by the server. This field is read only."
            : Array.isArray(value)
              ? `Comma-separated values. ${metadata.description || ""}`
              : metadata.description}
          {metadata.unit && ` (${metadata.unit})`}
        </small>
      )}
    </div>
  );
}
