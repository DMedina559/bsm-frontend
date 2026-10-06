import React, { useRef, useState } from "react";
import { useTheme } from "../ThemeContext";
import {
  DEFAULT_PALETTE,
  PALETTE_FIELDS,
  contrast,
  paletteCss,
  validatePalette,
} from "../utils/palettes";

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function PaletteEditor() {
  const {
    palettes = [],
    activePalette,
    savePalette,
    selectPalette,
    removePalette,
  } = useTheme();
  const [draft, setDraft] = useState(DEFAULT_PALETTE);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const input = useRef(null);
  const run = (action) => {
    try {
      action();
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  const importPalette = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 20000)
        throw new Error("Choose a palette JSON file smaller than 20 KB.");
      const palette = validatePalette(JSON.parse(await file.text()));
      setDraft(palette);
      setError(null);
      setNotice("Palette imported. Review the colors, then save to apply.");
    } catch (e) {
      setError(e.message || "This palette file could not be imported.");
    }
    event.target.value = "";
  };
  const lowContrast =
    Math.min(
      contrast(draft.text, draft.surface),
      contrast(draft.muted, draft.surface),
      contrast(draft.text, draft.page),
      contrast(draft.muted, draft.page),
    ) < 4.5;
  return (
    <section className="settings-panel palette-editor">
      <div className="section-heading">
        <div>
          <h2>Create a color palette</h2>
          <p>
            Personal palettes stay in this browser and override theme colors in
            every display mode. Export them to share or install as CSS themes.
          </p>
        </div>
      </div>
      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="palette-saved" role="group" aria-label="Saved palettes">
        <button
          className="action-button"
          aria-pressed={!activePalette}
          onClick={() => run(() => selectPalette(null))}
          type="button"
        >
          Use account theme
        </button>
        {palettes.map((p) => (
          <div className="inline-controls" key={p.name}>
            <button
              className="action-button"
              aria-pressed={activePalette === p.name}
              onClick={() =>
                run(() => {
                  selectPalette(p.name);
                  setDraft(p);
                })
              }
              type="button"
            >
              {p.name}
            </button>
            <button
              className="action-button secondary"
              aria-label={`Edit ${p.name}`}
              onClick={() => setDraft(p)}
              type="button"
            >
              Edit
            </button>
            <button
              className="action-button danger-button"
              aria-label={`Remove ${p.name}`}
              onClick={() => run(() => removePalette(p.name))}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => {
            savePalette(draft);
            setNotice("Palette saved and applied in this browser.");
          });
        }}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="palette-name">
            Palette name
          </label>
          <input
            id="palette-name"
            className="form-input"
            required
            maxLength={60}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <small className="form-help-text">
            Saving an existing name updates that palette.
          </small>
        </div>
        <div className="palette-colors">
          {Object.entries(PALETTE_FIELDS).map(([key, label]) => (
            <div className="form-group" key={key}>
              <label className="form-label" htmlFor={`palette-${key}`}>
                {label}
              </label>
              <input
                id={`palette-${key}`}
                type="color"
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
              <span className="palette-hex">{draft[key]}</span>
            </div>
          ))}
        </div>
        <div
          className="palette-preview"
          style={{ background: draft.page, color: draft.text }}
          aria-label="Palette preview"
        >
          <div style={{ background: draft.surface }}>
            <strong>Server workspace</strong>
            <p style={{ color: draft.muted }}>
              Secondary text and panel preview
            </p>
            <span style={{ borderBottom: `4px solid ${draft.accent}` }}>
              Accent color
            </span>
          </div>
        </div>
        {lowContrast && (
          <p className="message message-warning">
            Some text colors are below the recommended 4.5:1 contrast ratio.
            Adjust them before sharing this palette.
          </p>
        )}
        <div className="form-actions">
          <button className="action-button primary-button" type="submit">
            Save and apply palette
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() =>
              run(() =>
                download(
                  "bedrock-palette.json",
                  JSON.stringify(validatePalette(draft), null, 2),
                  "application/json",
                ),
              )
            }
          >
            Export palette
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() =>
              run(() =>
                download("bedrock-theme.css", paletteCss(draft), "text/css"),
              )
            }
          >
            Export CSS theme
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => input.current.click()}
          >
            Import palette
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="Import palette JSON"
          hidden
          onChange={importPalette}
        />
      </form>
    </section>
  );
}
