import React from "react";
import { useTheme } from "../../contexts/ThemeContext";

export default function PanoramaSettings() {
  const { appearance, updateAppearance, reducedMotion } = useTheme();
  const select = (key, label, options) => (
    <div className="form-group" key={key}>
      <label className="form-label" htmlFor={key}>
        {label}
      </label>
      <select
        id={key}
        className="form-input"
        value={appearance[key]}
        onChange={(event) => updateAppearance({ [key]: event.target.value })}
      >
        {options.map(([value, title]) => (
          <option key={value} value={value}>
            {title}
          </option>
        ))}
      </select>
    </div>
  );
  const range = (key, label, min, max, unit) => (
    <div className="form-group panorama-visibility">
      <label className="form-label" htmlFor={key}>
        {label}{" "}
        <output htmlFor={key}>
          {appearance[key]}
          {unit}
        </output>
      </label>
      <input
        id={key}
        type="range"
        min={min}
        max={max}
        value={appearance[key]}
        aria-valuetext={`${appearance[key]}${unit}`}
        onChange={(event) =>
          updateAppearance({ [key]: Number(event.target.value) })
        }
      />
    </div>
  );
  return (
    <div className="panorama-customization">
      <fieldset disabled={!appearance.panorama} className="panorama-controls">
        <legend>Panorama layout and movement</legend>
        <div className="form-grid">
          {select("panoramaSize", "Image size", [
            ["cover", "Fill screen"],
            ["contain", "Fit entire image"],
            ["auto", "Original size"],
            ["custom", "Custom scale"],
          ])}
          {appearance.panoramaSize === "custom" &&
            range("panoramaScale", "Image scale", 25, 300, "%")}
          {select("panoramaPosition", "Image position", [
            ["center", "Center"],
            ["top", "Top"],
            ["bottom", "Bottom"],
            ["left", "Left"],
            ["right", "Right"],
          ])}
          {select("panoramaRepeat", "Image repetition", [
            ["no-repeat", "No repetition"],
            ["repeat", "Tile"],
            ["repeat-x", "Repeat horizontally"],
            ["repeat-y", "Repeat vertically"],
          ])}
          {select("panoramaAttachment", "Scroll effect", [
            ["fixed", "Stay fixed"],
            ["scroll", "Scroll with page"],
            ["parallax", "Parallax"],
          ])}
          {appearance.panoramaAttachment === "parallax"
            ? range("panoramaScrollStrength", "Parallax strength", 0, 100, "%")
            : select("panoramaMotion", "Automatic movement", [
                ["none", "Still"],
                ["horizontal", "Horizontal pan"],
                ["diagonal", "Diagonal drift"],
              ])}
          {appearance.panoramaMotion !== "none" &&
            appearance.panoramaAttachment !== "parallax" &&
            range("panoramaDuration", "Movement duration", 20, 180, "s")}
        </div>
        <p className="form-help-text">
          Longer durations move more slowly. Parallax responds to scrolling;
          automatic movement runs independently.
        </p>
      </fieldset>
      <div className="form-group">
        {select("reducedMotion", "Reduced motion", [
          ["system", "Follow device setting"],
          ["reduce", "Always reduce motion"],
        ])}
        <p className="form-help-text">
          Limits interface animations, transitions, and panorama movement.{" "}
          {reducedMotion
            ? "Reduced motion is active."
            : "Reduced motion is currently off."}
        </p>
      </div>
    </div>
  );
}
