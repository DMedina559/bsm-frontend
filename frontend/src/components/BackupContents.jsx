import React, { useEffect, useRef } from "react";

import { backupComponents } from "../utils/backupContents";

export default function BackupContents({
  mode,
  components,
  onChange,
  disabled = false,
  allowDefault = false,
}) {
  const firstChoice = useRef(null);
  useEffect(() => {
    firstChoice.current?.setCustomValidity(
      mode === "selected" && components.length === 0
        ? "Select at least one component."
        : "",
    );
  }, [mode, components]);
  return (
    <fieldset
      disabled={disabled}
      className="backup-policy-section backup-contents"
    >
      <legend>Backup contents</legend>
      <label className="backup-contents-mode">
        Mode
        <select
          className="form-input"
          value={mode}
          onChange={(e) => onChange(e.target.value, components)}
        >
          {allowDefault && (
            <option value="default">Use configured default</option>
          )}
          <option value="world">World only</option>
          <option value="selected">Selected components</option>
          <option value="full">Full server directory</option>
        </select>
      </label>
      {mode === "selected" && (
        <div className="backup-component-options">
          {Object.entries(backupComponents).map(([key, label], index) => (
            <label className="backup-component-choice" key={key}>
              <input
                ref={index === 0 ? firstChoice : undefined}
                type="checkbox"
                checked={components.includes(key)}
                onChange={(e) =>
                  onChange(
                    mode,
                    e.target.checked
                      ? [...components, key]
                      : components.filter((c) => c !== key),
                  )
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
      {mode === "selected" && components.length === 0 && (
        <p role="alert">Select at least one component.</p>
      )}
      {mode === "world" && (
        <p>Captures the active world and its world-local packs.</p>
      )}
      {mode === "full" && (
        <p>
          Stop the server first. Includes every world, binaries, configuration
          and server packs, plus BSM server settings. Backup storage must be
          outside the server directory. Restore requires the same operating
          system, architecture and Bedrock version.
        </p>
      )}
    </fieldset>
  );
}
