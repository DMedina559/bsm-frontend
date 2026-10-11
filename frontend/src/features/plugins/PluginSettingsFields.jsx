import { useEffect, useState } from "react";
import { draftRegistry } from "../../app/draftRegistry";

export function JsonSetting({
  path,
  value,
  onChange,
  label = path,
  description,
}) {
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (invalid) return draftRegistry.register();
  }, [invalid]);
  const [text, setText] = useState(() =>
    JSON.stringify(value === undefined ? null : value, null, 2),
  );
  return (
    <div className="setting-item">
      <label className="form-label" htmlFor={`plugin-${path}`}>
        {label}
      </label>
      <textarea
        id={`plugin-${path}`}
        className="form-input plugin-json"
        value={text}
        aria-invalid={invalid}
        aria-describedby={`plugin-help-${path}`}
        onChange={(event) => {
          setText(event.target.value);
          try {
            const parsed = JSON.parse(event.target.value);
            onChange(path, parsed);
            event.target.setCustomValidity("");
            setInvalid(false);
          } catch {
            event.target.setCustomValidity("Enter valid JSON.");
            setInvalid(true);
          }
        }}
      />
      <small className="form-help-text" id={`plugin-help-${path}`}>
        {invalid
          ? "Enter valid JSON before saving."
          : description ||
            "JSON values retain their types, including arrays and nested objects."}
      </small>
    </div>
  );
}

export default function PluginSettingsFields({ values, schema, onChange }) {
  function resolve(field) {
    if (field?.$ref?.startsWith("#/$defs/"))
      return schema.$defs?.[field.$ref.slice(8)] ?? field;
    return field ?? {};
  }
  function fields(properties, data, prefix = "", required = []) {
    return Object.entries(properties).map(([name, original]) => {
      let field = resolve(original);
      const path = prefix ? `${prefix}.${name}` : name;
      const nullable = field.anyOf?.some((item) => item.type === "null");
      if (field.anyOf)
        field = {
          ...field,
          ...resolve(field.anyOf.find((item) => item.type !== "null")),
        };
      const value = data?.[name];
      const label = original.title || field.title || name.replace(/_/g, " ");
      if (field.type === "object" && field.properties)
        return (
          <section className="settings-group" key={path}>
            <h3>{label}</h3>
            <div className="settings-grid">
              {fields(field.properties, value, path, field.required)}
            </div>
          </section>
        );
      if (
        nullable ||
        !["string", "number", "integer", "boolean"].includes(field.type)
      )
        return (
          <JsonSetting
            key={path}
            path={path}
            label={label}
            value={value ?? null}
            onChange={onChange}
            description={field.description}
          />
        );
      const number = field.type === "integer" || field.type === "number";
      return (
        <div className="setting-item" key={path}>
          <label className="form-label" htmlFor={`plugin-${path}`}>
            {label}
          </label>
          {field.enum || field.type === "boolean" ? (
            <select
              className="form-input"
              id={`plugin-${path}`}
              value={String(value ?? field.default ?? "")}
              required={required?.includes(name)}
              onChange={(event) =>
                onChange(
                  path,
                  field.type === "boolean"
                    ? event.target.value === "true"
                    : field.enum.find(
                        (item) => String(item) === event.target.value,
                      ),
                )
              }
            >
              <option value="" disabled>
                Select a value
              </option>
              {(field.enum || [true, false]).map((item) => (
                <option key={String(item)} value={String(item)}>
                  {typeof item === "boolean"
                    ? item
                      ? "Enabled"
                      : "Disabled"
                    : String(item)}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="form-input"
              id={`plugin-${path}`}
              type={
                number
                  ? "number"
                  : field.format === "password"
                    ? "password"
                    : "text"
              }
              value={value ?? field.default ?? ""}
              required={required?.includes(name)}
              min={field.minimum ?? field.exclusiveMinimum}
              max={field.maximum ?? field.exclusiveMaximum}
              step={field.multipleOf ?? (field.type === "integer" ? 1 : "any")}
              minLength={field.minLength}
              maxLength={field.maxLength}
              onChange={(event) =>
                onChange(
                  path,
                  number && event.target.value !== ""
                    ? Number(event.target.value)
                    : event.target.value,
                )
              }
            />
          )}
          {field.description && (
            <small className="form-help-text">{field.description}</small>
          )}
        </div>
      );
    });
  }
  if (!schema?.properties)
    return (
      <JsonSetting
        path="settings"
        label="Plugin settings"
        value={values}
        onChange={(_path, value) => onChange("", value)}
      />
    );
  return (
    <div className="settings-grid">
      {fields(schema.properties, values, "", schema.required)}
    </div>
  );
}
