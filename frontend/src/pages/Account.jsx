import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { useToast } from "../ToastContext";
import { get, post } from "../api";
import { Save, User, Palette, RotateCcw } from "lucide-react";
import { BUILT_IN_THEMES, THEME_LABELS } from "../utils/theme";
const Account = () => {
  const { user } = useAuth();
  const {
    theme,
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
  }, []);
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
          <p className="platform-eyebrow">YOUR WORKSPACE</p>
          <h1>My Account</h1>
        </div>
      </div>
      <section className="settings-panel">
        <div className="section-heading">
          <User size={20} />
          <div>
            <h2>Profile</h2>
            <p>Your platform identity and access level.</p>
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
        <div className="theme-grid" role="group" aria-label="Account theme">
          {availableThemes.map((item) => (
            <button
              key={item}
              className={`theme-card ${theme === item ? "selected" : ""}`}
              aria-pressed={theme === item}
              disabled={themeSaving}
              onClick={() => handleThemeChange(item)}
              type="button"
            >
              <span
                className={`theme-swatch theme-swatch-${BUILT_IN_THEMES.includes(item) ? item : "custom"}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
              </span>
              <strong>{THEME_LABELS[item] || item.replace(/_/g, " ")}</strong>
              <small>
                {theme === item
                  ? "Selected"
                  : BUILT_IN_THEMES.includes(item)
                    ? "Built-in theme"
                    : "Custom theme"}
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
              Adjust control heights and table spacing.
            </small>
          </div>
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
      <section className="settings-panel">
        <div className="section-heading">
          <Save size={20} />
          <div>
            <h2>Change Password</h2>
            <p>Use a unique password for your platform account.</p>
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
                  key === "confirmPassword" && passwordError ? true : undefined
                }
                aria-describedby={passwordError ? "password-error" : undefined}
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
    </div>
  );
};
export default Account;
