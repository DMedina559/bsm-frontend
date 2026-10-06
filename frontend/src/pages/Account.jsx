import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { useToast } from "../ToastContext";
import { get, post } from "../api";
import { Save, User, Palette, RotateCcw } from "lucide-react";
import { BUILT_IN_THEMES, THEME_LABELS } from "../utils/theme";
import themePreviews from "../utils/themePreviews.json";
import PaletteEditor from "../components/PaletteEditor";
const Account = ({ appearanceOnly = false }) => {
  const { user } = useAuth();
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
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [availableThemes, setAvailableThemes] = useState(BUILT_IN_THEMES);
  const [themesNotice, setThemesNotice] = useState(null);
  useEffect(() => {
    let active = true;
    get("/api/info/themes")
      .then((response) => {
        if (!active) return;
        if (Array.isArray(response?.themes))
          setAvailableThemes([
            ...new Set([
              ...BUILT_IN_THEMES,
              ...(theme && !BUILT_IN_THEMES.includes(theme) ? [theme] : []),
              ...response.themes.filter(
                (item) => typeof item === "string" && item.trim(),
              ),
            ]),
          ]);
        else
          setThemesNotice(
            "Custom themes are unavailable. Built-in themes are shown below.",
          );
      })
      .catch(() => {
        if (active)
          setThemesNotice(
            "Custom themes could not be loaded. Built-in themes are available.",
          );
      });
    return () => {
      active = false;
    };
  }, [theme]);
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
  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (passwordSaving) return;
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await post("/api/account/change-password", {
        current_password: passwords.currentPassword,
        new_password: passwords.newPassword,
      });
      addToast("Password updated successfully.", "success");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setPasswordError(error.message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };
  const fields = [
    [
      "currentPassword",
      "current-password",
      "Current Password",
      "current-password",
    ],
    ["newPassword", "new-password", "New Password", "new-password"],
    [
      "confirmPassword",
      "confirm-password",
      "Confirm New Password",
      "new-password",
    ],
  ];
  return (
    <div className="container account-page">
      <div className="header">
        <div>
          <p className="workspace-eyebrow">YOUR WORKSPACE</p>
          <h1>{appearanceOnly ? "Appearance" : "My Account"}</h1>
        </div>
      </div>
      {!appearanceOnly && (
        <section className="settings-panel">
          <div className="section-heading">
            <User size={20} />
            <div>
              <h2>Profile</h2>
              <p>Your account identity and access level.</p>
            </div>
          </div>
          <dl className="profile-details">
            <div>
              <dt>Username</dt>
              <dd>{user?.username}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <span className="badge">{user?.role}</span>
              </dd>
            </div>
          </dl>
        </section>
      )}
      {appearanceOnly && (
        <section className="settings-panel" id="appearance">
          <div className="section-heading">
            <Palette size={20} />
            <div>
              <h2>Theme</h2>
              <p>
                Choose an account theme. Display mode and density are saved in
                this browser.
              </p>
            </div>
          </div>
          {themesNotice && <p className="form-help-text">{themesNotice}</p>}
          {themeError && (
            <div className="message message-error" role="alert">
              {themeError}
            </div>
          )}
          <details className="theme-install-help">
            <summary>How to add a CSS theme</summary>
            <p>
              Server-installed themes appear below automatically. Ask your
              administrator to install a CSS file in the backend’s themes
              directory; it must be listed by the themes API and served at
              /themes/NAME.css. Reload this page after installation.
            </p>
            <p>
              Use the palette creator below to make a theme without writing CSS,
              then export its CSS for installation. Personal palettes are saved
              in this browser; server CSS themes are shared through the backend
              and selected on your account.
            </p>
          </details>
          <h3>Built-in and installed CSS themes</h3>
          {activePalette && (
            <p className="form-help-text">
              The personal palette “{activePalette}” currently overrides account
              theme colors. Selecting a theme below turns the palette off.
            </p>
          )}
          {!availableThemes.some((item) => !BUILT_IN_THEMES.includes(item)) && (
            <p className="form-help-text">
              No server CSS themes are listed. Built-in themes are ready to use;
              see installation guidance above to add more.
            </p>
          )}
          <div className="theme-grid" role="group" aria-label="Account theme">
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
                          ? { background: themePreviews[item].colors[index] }
                          : undefined
                      }
                    />
                  ))}
                </span>
                <strong>{THEME_LABELS[item] || item.replace(/_/g, " ")}</strong>
                <small>
                  {theme === item && !activePalette
                    ? "Selected"
                    : BUILT_IN_THEMES.includes(item)
                      ? themePreviews[item]?.description || "Built-in theme"
                      : "Server CSS theme"}
                </small>
              </button>
            ))}
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
          <div className="form-group panorama-preference">
            <label className="checkbox-wrapper" htmlFor="panorama-background">
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
              default and saved only in this browser. Theme colors remain in use
              if the image is unavailable.
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
              <small id="panorama-visibility-help" className="form-help-text">
                Higher values make the image more prominent. Panel backgrounds
                keep their theme colors.
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
            <small id="sidebar-transparency-help" className="form-help-text">
              Higher values reveal more of the background through the sidebar.
              Text and controls stay opaque.
            </small>
          </div>
          <button
            className="action-button secondary"
            onClick={resetAppearance}
            type="button"
          >
            <RotateCcw size={16} />
            Reset display preferences
          </button>
        </section>
      )}
      {appearanceOnly && <PaletteEditor />}
      {!appearanceOnly && (
        <section className="settings-panel">
          <div className="section-heading">
            <Save size={20} />
            <div>
              <h2>Change Password</h2>
              <p>Use a unique password for your account.</p>
            </div>
          </div>
          <form
            onSubmit={handlePasswordChange}
            className="password-form"
            aria-busy={passwordSaving}
          >
            <input
              type="text"
              name="username"
              value={user?.username || ""}
              autoComplete="username"
              hidden
              readOnly
            />
            {fields.map(([key, id, label, autoComplete]) => (
              <div className="form-group" key={key}>
                <label className="form-label" htmlFor={id}>
                  {label}
                </label>
                <input
                  className="form-input"
                  id={id}
                  name={id}
                  type="password"
                  value={passwords[key]}
                  onChange={(event) =>
                    setPasswords({
                      ...passwords,
                      [key]: event.target.value,
                    })
                  }
                  required
                  autoComplete={autoComplete}
                  disabled={passwordSaving}
                  aria-invalid={
                    key === "confirmPassword" && passwordError
                      ? true
                      : undefined
                  }
                  aria-describedby={
                    passwordError ? "password-error" : undefined
                  }
                />
              </div>
            ))}
            {passwordError && (
              <p className="validation-error" role="alert" id="password-error">
                {passwordError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="submit"
                className="action-button primary-button"
                disabled={passwordSaving}
              >
                <Save size={16} />
                {passwordSaving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
export default Account;
