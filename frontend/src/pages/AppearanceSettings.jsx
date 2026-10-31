import React from "react";
import { Palette, RotateCcw } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { usePreference } from "../app/usePreference";
import { useResourceQuery } from "../app/resourceQueries";
import { DEFAULT_METRIC_UNITS } from "../utils/metricUnits";
import { BUILT_IN_THEMES, THEME_LABELS } from "../utils/theme";
import themePreviews from "../utils/themePreviews.json";
import TimeDisplaySettings from "../components/appearance/TimeDisplaySettings";
import MetricUnitSettings from "../components/metrics/MetricUnitSettings";
import PanoramaSettings from "../components/appearance/PanoramaSettings";
import PaletteEditor from "../components/PaletteEditor";
import "../styles/appearance.css";
export default function AppearanceSettings({ section = "appearance" }) {
  const [, setMetricUnits] = usePreference("metricUnits", DEFAULT_METRIC_UNITS);
  const {
    theme,
    activePalette,
    changeTheme,
    themeError,
    themeSaving,
    appearance,
    updateAppearance,
    resetAppearance,
  } = useTheme();
  const { addToast } = useToast();
  const themesQuery = useResourceQuery("themes");
  const availableThemes = [
    ...new Set([
      ...BUILT_IN_THEMES,
      ...(theme && !BUILT_IN_THEMES.includes(theme) ? [theme] : []),
      ...(themesQuery.data ?? []),
    ]),
  ];
  const themesNotice = themesQuery.error
    ? "Custom themes could not be loaded. Built-in themes are available."
    : null;
  const handleThemeChange = async (newTheme) => {
    try {
      if (await changeTheme(newTheme))
        addToast(
          `Theme changed to ${THEME_LABELS[newTheme] || newTheme}`,
          "success",
        );
    } catch (error) {
      addToast(error.message || "Theme could not be saved", "error");
    }
  };
  return (
    <div className="appearance-page">
      <div id="appearance" className="appearance-sections">
        {section === "appearance" && (
          <>
            <section
              className="settings-panel appearance-theme"
              aria-labelledby="appearance-theme-title"
            >
              <div className="section-heading">
                <Palette size={20} />
                <div>
                  <h2 id="appearance-theme-title">Theme</h2>
                  <p>Choose your colors. Your theme follows your account.</p>
                </div>
              </div>
              {themesNotice && <p className="form-help-text">{themesNotice}</p>}
              {themeError && (
                <div className="message message-error" role="alert">
                  {themeError}
                </div>
              )}

              {activePalette && (
                <p className="form-help-text">
                  The personal palette “{activePalette}” currently overrides
                  account theme colors. Selecting a theme below turns the
                  palette off.
                </p>
              )}
              <div
                className="theme-grid"
                role="group"
                aria-label="Account theme"
              >
                {availableThemes.map((item) => (
                  <button
                    key={item}
                    className={`theme-card ${theme === item && !activePalette ? "selected" : ""}`}
                    aria-pressed={theme === item && !activePalette}
                    disabled={themeSaving}
                    onClick={() => handleThemeChange(item)}
                    type="button"
                  >
                    <span
                      className={`theme-swatch theme-swatch-${BUILT_IN_THEMES.includes(item) ? item : "custom"}`}
                      aria-hidden="true"
                    >
                      {[0, 1, 2].map((index) => (
                        <i
                          key={index}
                          style={
                            themePreviews[item]
                              ? {
                                  background: themePreviews[item].colors[index],
                                }
                              : undefined
                          }
                        />
                      ))}
                    </span>
                    <strong>
                      {THEME_LABELS[item] || item.replace(/_/g, " ")}
                    </strong>
                    <small>
                      {theme === item && !activePalette ? "Selected · " : ""}
                      {BUILT_IN_THEMES.includes(item)
                        ? themePreviews[item]?.description || "Built-in theme"
                        : "Server CSS theme"}
                    </small>
                  </button>
                ))}
              </div>
              <details className="theme-install-help">
                <summary>How to add a CSS theme</summary>
                <p>
                  Server-installed themes appear below automatically. Ask your
                  administrator to install a CSS file in the backend’s themes
                  directory; it must be listed by the themes API and served at
                  /themes/NAME.css. Reload this page after installation.
                </p>
                <p>
                  Use the palette creator below to make a theme without writing
                  CSS, then export its CSS for installation. Personal palettes
                  are saved in this browser; server CSS themes are shared
                  through the backend and selected on your account.
                </p>
              </details>
            </section>
          </>
        )}
        {section === "display" && (
          <div className="appearance-preference-grid">
            <section
              className="settings-panel"
              aria-labelledby="appearance-display-title"
            >
              <div className="section-heading">
                <div>
                  <h2 id="appearance-display-title">Display</h2>
                  <p>Choose how the interface fits your screen.</p>
                </div>
              </div>
              <div className="form-grid appearance-controls">
                <div className="form-group">
                  <label className="form-label" htmlFor="display-mode">
                    Display mode
                  </label>
                  <select
                    className="form-input"
                    id="display-mode"
                    value={appearance.mode}
                    onChange={(event) =>
                      updateAppearance({
                        mode: event.target.value,
                      })
                    }
                  >
                    <option value="theme">Use theme default</option>
                    <option value="system">Follow system</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                  <small className="form-help-text">
                    Custom themes can use the same light and dark tokens.
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="display-density">
                    Interface density
                  </label>
                  <select
                    className="form-input"
                    id="display-density"
                    value={appearance.density}
                    onChange={(event) =>
                      updateAppearance({
                        density: event.target.value,
                      })
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                  <small className="form-help-text">
                    Adjust text sizes, cards, padding, navigation, and table
                    spacing.
                  </small>
                </div>
              </div>
            </section>
            <TimeDisplaySettings />
            <MetricUnitSettings />
          </div>
        )}
        {section === "appearance" && (
          <section
            className="settings-panel appearance-background"
            aria-labelledby="appearance-background-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="appearance-background-title">Background</h2>
                <p>
                  Customize the panorama’s layout, visibility, and movement.
                </p>
              </div>
            </div>
            <div className="appearance-background-grid">
              <div className="form-group panorama-preference">
                <label
                  className="checkbox-wrapper"
                  htmlFor="panorama-background"
                >
                  <input
                    type="checkbox"
                    role="switch"
                    id="panorama-background"
                    checked={appearance.panorama === true}
                    onChange={(event) =>
                      updateAppearance({ panorama: event.target.checked })
                    }
                    aria-describedby="panorama-help"
                  />
                  <span className="form-label-inline">Panorama background</span>
                </label>
                <p className="form-help-text" id="panorama-help">
                  Use the server’s panorama behind the interface. Disabled by
                  default and saved for this account in this browser. Theme
                  colors remain in use if the image is unavailable.
                </p>
                <div className="panorama-visibility">
                  <label className="form-label" htmlFor="panorama-visibility">
                    Panorama visibility{" "}
                    <output htmlFor="panorama-visibility">
                      {appearance.panoramaVisibility ?? 18}%
                    </output>
                  </label>
                  <input
                    id="panorama-visibility"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={appearance.panoramaVisibility ?? 18}
                    disabled={!appearance.panorama}
                    aria-valuetext={`${appearance.panoramaVisibility ?? 18}% visible`}
                    aria-describedby="panorama-visibility-help"
                    onChange={(event) =>
                      updateAppearance({
                        panoramaVisibility: Number(event.target.value),
                      })
                    }
                  />
                  <small
                    id="panorama-visibility-help"
                    className="form-help-text"
                  >
                    Higher values make the image more prominent. Panel
                    backgrounds keep their theme colors.
                  </small>
                </div>
              </div>
              <div className="form-group panorama-visibility">
                <label className="form-label" htmlFor="sidebar-transparency">
                  Sidebar transparency{" "}
                  <output htmlFor="sidebar-transparency">
                    {appearance.sidebarTransparency ?? 0}%
                  </output>
                </label>
                <input
                  id="sidebar-transparency"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={appearance.sidebarTransparency ?? 0}
                  aria-valuetext={`${appearance.sidebarTransparency ?? 0}% transparent`}
                  aria-describedby="sidebar-transparency-help"
                  onChange={(event) =>
                    updateAppearance({
                      sidebarTransparency: Number(event.target.value),
                    })
                  }
                />
                <small
                  id="sidebar-transparency-help"
                  className="form-help-text"
                >
                  Higher values reveal more of the background through the
                  sidebar. Text and controls stay opaque.
                </small>
              </div>
            </div>
            <PanoramaSettings />
          </section>
        )}
        <div className="appearance-reset">
          <p>
            Display, background, and metric preferences are saved for this
            account in this browser.
          </p>
          <button
            className="action-button secondary"
            onClick={async () => {
              try {
                if (await resetAppearance()) {
                  setMetricUnits(DEFAULT_METRIC_UNITS);
                  addToast("Appearance reset to defaults.", "success");
                }
              } catch (error) {
                addToast(
                  error.message || "Appearance could not be reset.",
                  "error",
                );
              }
            }}
            disabled={themeSaving}
            type="button"
          >
            <RotateCcw size={16} />
            Reset appearance
          </button>
        </div>
      </div>
      {section === "appearance" && <PaletteEditor />}
    </div>
  );
}
