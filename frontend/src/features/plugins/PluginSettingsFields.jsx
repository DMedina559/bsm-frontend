import { useEffect, useRef, useState } from "react";
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

function EnumArraySetting({
  path,
  value,
  items,
  field,
  label,
  onChange,
  required,
}) {
  const selected = Array.isArray(value) ? value : [];
  const input = useRef(null);
  const enforce = required || Array.isArray(value);
  const error =
    enforce && selected.length < (field.minItems ?? 0)
      ? `Choose at least ${field.minItems} option${field.minItems === 1 ? "" : "s"}.`
      : enforce && selected.length > (field.maxItems ?? Infinity)
        ? `Choose at most ${field.maxItems} options.`
        : "";
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  const choices = [...new Set([...items.enum, ...selected])];
  const labels =
    field["x-bsm-choice-labels"] ?? items["x-bsm-choice-labels"] ?? {};
  return (
    <fieldset
      className="setting-item plugin-server-checklist"
      aria-describedby={`plugin-help-${path}`}
    >
      <legend className="form-label">{label}</legend>
      <div className="plugin-server-options">
        {choices.map((choice, index) => {
          const available = items.enum.includes(choice);
          return (
            <label
              className="plugin-server-option"
              key={JSON.stringify(choice)}
            >
              <input
                ref={index === 0 ? input : undefined}
                type="checkbox"
                checked={selected.includes(choice)}
                aria-invalid={!!error}
                disabled={!available && !selected.includes(choice)}
                onChange={(event) =>
                  onChange(
                    path,
                    event.target.checked
                      ? [...selected, choice]
                      : selected.filter((item) => item !== choice),
                  )
                }
              />
              <span>
                {labels[choice] ?? String(choice)}
                {available ? "" : " (unavailable)"}
              </span>
            </label>
          );
        })}
        {!items.enum.length && (
          <small className="form-help-text">
            {items["x-bsm-server-name"]
              ? "No valid servers available."
              : "No options available."}
          </small>
        )}
      </div>
      <small id={`plugin-help-${path}`} className="form-help-text">
        {error || field.description}
      </small>
      {!(field.minItems > 0) && (
        <button
          type="button"
          className="action-button secondary"
          onClick={() => onChange(path, [])}
        >
          Clear selection
        </button>
      )}
    </fieldset>
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
      const items = resolve(field.items);
      if (field.type === "array" && Array.isArray(items.enum))
        return (
          <EnumArraySetting
            key={path}
            path={path}
            value={value}
            items={items}
            field={field}
            label={label}
            onChange={onChange}
            required={required?.includes(name)}
          />
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
