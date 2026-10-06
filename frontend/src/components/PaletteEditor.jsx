import React, { useRef, useState } from "react";
import Modal from "./Modal";
import { Palette, Plus, Pencil, Trash2 } from "lucide-react";
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
  const [editorOpen, setEditorOpen] = useState(false);
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
      setEditorOpen(true);
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
      <div className="palette-section-header">
        <div className="section-heading">
          <Palette size={20} />
          <div>
            <h2>Personal palettes</h2>
            <p>Saved in this browser. Select a palette to apply its colors.</p>
          </div>
        </div>
        <div className="inline-controls">
          <button
            type="button"
            className="action-button secondary"
            onClick={() => input.current.click()}
          >
            Import palette
          </button>
          <button
            type="button"
            className="action-button primary-button"
            onClick={() => {
              setDraft({ ...DEFAULT_PALETTE, name: "" });
              setError(null);
              setEditorOpen(true);
            }}
          >
            <Plus size={16} />
            Create palette
          </button>
        </div>
      </div>
      {notice && (
        <p className="form-help-text" role="status">
          {notice}
        </p>
      )}
      {!editorOpen && error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}
      <div className="theme-grid" role="group" aria-label="Saved palettes">
        <button
          className={`theme-card ${!activePalette ? "selected" : ""}`}
          aria-pressed={!activePalette}
          onClick={() => run(() => selectPalette(null))}
          type="button"
        >
          <span
            className="theme-swatch theme-swatch-default"
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <strong>Use account theme</strong>
          <small>
            {!activePalette ? "Selected" : "Restore account colors"}
          </small>
        </button>
        {palettes.map((p) => (
          <div className="personal-palette-card" key={p.name}>
            <button
              type="button"
              className={`theme-card ${activePalette === p.name ? "selected" : ""}`}
              aria-pressed={activePalette === p.name}
              onClick={() => run(() => selectPalette(p.name))}
            >
              <span className="theme-swatch" aria-hidden="true">
                <i style={{ background: p.page }} />
                <i style={{ background: p.surface }} />
                <i style={{ background: p.accent }} />
              </span>
              <strong>{p.name}</strong>
              <small>
                {activePalette === p.name ? "Selected" : "Personal palette"}
              </small>
            </button>
            <div className="palette-card-actions">
              <button
                className="icon-button"
                type="button"
                aria-label={`Edit ${p.name}`}
                title="Edit palette"
                onClick={() => {
                  setDraft(p);
                  setError(null);
                  setEditorOpen(true);
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove ${p.name}`}
                title="Remove palette"
                onClick={() => run(() => removePalette(p.name))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label="Import palette JSON"
        hidden
        onChange={importPalette}
      />
      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Palette editor"
        className="palette-editor-dialog"
      >
        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => {
              savePalette(draft);
              setNotice("Palette saved and applied in this browser.");
              setEditorOpen(false);
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
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
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
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
