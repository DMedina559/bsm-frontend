import { Download } from "lucide-react";
import { PluginIcon } from "./icons";
export const formsComponents = {
  Button: ({
    label,
    onClick,
    variant = "primary",
    icon,
    disabled = false,
    className = "",
  }) => {
    const Icon = icon
      ? PluginIcon({
          name: icon,
          size: 16,
        })
      : null;
    return (
      <button
        className={`action-button ${variant === "secondary" ? "secondary" : ""} ${variant === "danger" ? "danger-button" : variant === "primary" ? "primary-button" : ""} ${className}`}
        onClick={onClick}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(5px * var(--bsm-spacing-scale))",
        }}
        type="button"
      >
        {Icon}
        {label}
      </button>
    );
  },
  Input: ({
    id,
    name,
    label,
    ariaLabel,
    type = "text",
    value,
    onChange,
    placeholder,
    className = "",
    readOnly = false,
    disabled = false,
  }) => (
    <input
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      type={type}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      className={`form-input ${className}`}
      readOnly={readOnly}
      disabled={disabled}
    />
  ),
  Textarea: ({
    id,
    name,
    label,
    ariaLabel,
    value,
    onChange,
    placeholder,
    rows = 4,
    className = "",
    readOnly = false,
    disabled = false,
  }) => (
    <textarea
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`form-input ${className}`}
      readOnly={readOnly}
      disabled={disabled}
      style={{
        width: "100%",
        resize: "vertical",
      }}
    />
  ),
  Slider: ({
    id,
    name,
    label,
    ariaLabel,
    value = 0,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    className = "",
  }) => (
    <div
      className={`slider-container ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "calc(10px * var(--bsm-spacing-scale))",
      }}
    >
      <input
        id={id}
        name={name}
        aria-label={
          ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
        }
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        disabled={disabled}
        style={{
          flex: 1,
        }}
      />
      <span className="slider-value-display">{value}</span>
    </div>
  ),
  Select: ({
    value,
    onChange,
    options,
    className = "",
    disabled = false,
    id,
    name,
    label,
    ariaLabel,
  }) => (
    <select
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      className={`form-input ${className}`}
      disabled={disabled}
    >
      {options &&
        options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
    </select>
  ),
  Switch: ({
    value,
    onChange,
    label,
    className = "",
    disabled = false,
    id,
  }) => (
    <div className={`switch-wrapper ${className}`}>
      <label className="switch" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          checked={!!value}
          onChange={(e) => onChange && onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="slider round"></span>
      </label>
      {label && (
        <label className="switch-label-text" htmlFor={id}>
          {label}
        </label>
      )}
    </div>
  ),
  Checkbox: ({
    value,
    onChange,
    label,
    className = "",
    disabled = false,
    id,
  }) => (
    <label className={`checkbox-wrapper ${className}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={!!value}
        onChange={(e) => onChange && onChange(e.target.checked)}
        disabled={disabled}
      />
      {label && <span className="form-label-inline">{label}</span>}
    </label>
  ),
  FileUpload: ({
    id,
    name,
    label,
    ariaLabel,
    accept,
    onChange,
    className = "",
  }) => (
    <input
      id={id}
      name={name}
      aria-label={
        ariaLabel || label || (name ? name.replace(/[_-]/g, " ") : undefined)
      }
      type="file"
      accept={accept}
      onChange={(e) => onChange && onChange(e.target.files[0])}
      className={`form-input ${className}`}
    />
  ),
  FileDownload: ({
    label,
    onClick,
    variant = "primary",
    className = "",
    style = {},
  }) => (
    <button
      className={`action-button ${variant === "secondary" ? "secondary" : ""} ${className}`}
      onClick={onClick}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: "calc(5px * var(--bsm-spacing-scale))",
      }}
      type="button"
    >
      <PluginIcon name="Download" size={16} />
      {label || "Download"}
    </button>
  ),
};
